-- Final credit-system repair.
-- Supports both the new user+device debit RPC and the older device-only debit RPC.

CREATE OR REPLACE FUNCTION public.recalculate_profile_credits(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
  INTO v_balance
  FROM public.credit_transactions
  WHERE user_id = p_profile_id;

  UPDATE public.profiles
  SET credits = COALESCE(v_balance, 0),
      updated_at = now()
  WHERE id = p_profile_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_signup_bonus(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE user_id = p_profile_id
      AND type = 'signup_bonus'
  ) THEN
    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      type,
      description
    )
    VALUES (
      p_profile_id,
      1,
      'signup_bonus',
      'Hoş geldin bonusu - 1 ücretsiz sorgu'
    );
  END IF;

  PERFORM public.recalculate_profile_credits(p_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_device_to_user(p_device_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_device_profile_id uuid;
  v_user_profile_id uuid;
  v_credits integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_device_id');
  END IF;

  SELECT id
  INTO v_device_profile_id
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE id = v_uid OR user_id = v_uid
  ORDER BY CASE WHEN id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1;

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      INSERT INTO public.profiles (
        id,
        device_id,
        user_id,
        credits,
        created_at,
        updated_at
      )
      VALUES (
        v_uid,
        p_device_id,
        v_uid,
        0,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = v_uid,
          updated_at = now()
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      UPDATE public.credit_transactions
      SET user_id = v_user_profile_id
      WHERE user_id = v_device_profile_id
        AND type <> 'signup_bonus';

      DELETE FROM public.profiles
      WHERE id = v_device_profile_id;
    END IF;

    UPDATE public.profiles
    SET user_id = v_uid,
        device_id = p_device_id,
        updated_at = now()
    WHERE id = v_user_profile_id;
  END IF;

  PERFORM public.ensure_signup_bonus(v_user_profile_id);
  v_credits := public.recalculate_profile_credits(v_user_profile_id);

  RETURN json_build_object(
    'success', true,
    'profile_id', v_user_profile_id,
    'device_id', p_device_id,
    'credits', v_credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_credit_for_user_device(
  p_user_id uuid,
  p_device_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_profile_id uuid;
  v_device_profile_id uuid;
  v_current_credits integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;

  SELECT id
  INTO v_device_profile_id
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE id = p_user_id OR user_id = p_user_id
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = p_user_id,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      INSERT INTO public.profiles (
        id,
        device_id,
        user_id,
        credits,
        created_at,
        updated_at
      )
      VALUES (
        p_user_id,
        p_device_id,
        p_user_id,
        0,
        now(),
        now()
      )
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      UPDATE public.credit_transactions
      SET user_id = v_user_profile_id
      WHERE user_id = v_device_profile_id
        AND type <> 'signup_bonus';

      DELETE FROM public.profiles
      WHERE id = v_device_profile_id;
    END IF;

    UPDATE public.profiles
    SET user_id = p_user_id,
        device_id = p_device_id,
        updated_at = now()
    WHERE id = v_user_profile_id;
  END IF;

  PERFORM public.ensure_signup_bonus(v_user_profile_id);
  v_current_credits := public.recalculate_profile_credits(v_user_profile_id);

  IF v_current_credits < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    description
  )
  VALUES (
    v_user_profile_id,
    'usage',
    -1,
    'Arazi analizi'
  );

  PERFORM public.recalculate_profile_credits(v_user_profile_id);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_credit_by_device(p_device_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_user_id uuid;
BEGIN
  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;

  SELECT id, user_id
  INTO v_profile_id, v_user_id
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.deduct_credit_for_user_device(COALESCE(v_user_id, v_profile_id), p_device_id);
END;
$$;

WITH missing_auth_profiles AS (
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Kullanıcı') AS display_name,
    u.raw_user_meta_data ->> 'avatar_url' AS avatar_url
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = u.id OR p.user_id = u.id
  )
)
INSERT INTO public.profiles (
  id,
  email,
  display_name,
  avatar_url,
  credits,
  created_at,
  updated_at,
  user_id
)
SELECT
  id,
  email,
  display_name,
  avatar_url,
  0,
  now(),
  now(),
  id
FROM missing_auth_profiles
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

WITH auth_profiles AS (
  SELECT DISTINCT p.id AS profile_id
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id OR p.user_id = u.id
),
missing_signup_bonus AS (
  SELECT ap.profile_id
  FROM auth_profiles ap
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions ct
    WHERE ct.user_id = ap.profile_id
      AND ct.type = 'signup_bonus'
  )
)
INSERT INTO public.credit_transactions (
  user_id,
  amount,
  type,
  description
)
SELECT
  profile_id,
  1,
  'signup_bonus',
  'Hoş geldin bonusu - 1 ücretsiz sorgu'
FROM missing_signup_bonus;

WITH transaction_balances AS (
  SELECT user_id, GREATEST(COALESCE(SUM(amount), 0), 0)::integer AS balance
  FROM public.credit_transactions
  GROUP BY user_id
)
UPDATE public.profiles p
SET credits = transaction_balances.balance,
    updated_at = now()
FROM transaction_balances
WHERE p.id = transaction_balances.user_id
  AND p.credits IS DISTINCT FROM transaction_balances.balance;

REVOKE EXECUTE ON FUNCTION public.deduct_credit_by_device(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credit_for_user_device(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_profile_credits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.deduct_credit_by_device(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credit_for_user_device(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;
