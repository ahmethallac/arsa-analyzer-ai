-- Final credit ledger rules:
-- - Every authenticated account gets exactly one signup_bonus transaction.
-- - Displayed credits are always the non-negative sum of credit_transactions.
-- - Profile refresh never creates extra credits after the signup bonus exists.
-- - Analysis can only debit a profile linked to the supplied device id.
-- - TEST2026 adds 2 credits once per profile/device.

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
  SET credits = v_balance,
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'Kullanıcı'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    0,
    now(),
    now(),
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE
  SET user_id = NEW.id,
      email = EXCLUDED.email,
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
      updated_at = now();

  PERFORM public.ensure_signup_bonus(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

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
      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_device_profile_id;

      PERFORM public.ensure_signup_bonus(v_device_profile_id);
      v_credits := public.recalculate_profile_credits(v_device_profile_id);

      RETURN json_build_object(
        'success', true,
        'profile_id', v_device_profile_id,
        'device_id', p_device_id,
        'credits', v_credits
      );
    END IF;

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
    RETURNING id INTO v_user_profile_id;
  END IF;

  IF v_device_profile_id IS NOT NULL THEN
    IF v_device_profile_id <> v_user_profile_id THEN
      UPDATE public.credit_transactions
      SET user_id = v_user_profile_id
      WHERE user_id = v_device_profile_id
        AND type <> 'signup_bonus';

      DELETE FROM public.profiles
      WHERE id = v_device_profile_id;
    END IF;
  END IF;

  UPDATE public.profiles
  SET user_id = v_uid,
      device_id = p_device_id,
      updated_at = now()
  WHERE id = v_user_profile_id;

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

CREATE OR REPLACE FUNCTION public.deduct_credit_by_device(p_device_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_current_credits integer;
BEGIN
  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;

  SELECT id
  INTO v_profile_id
  FROM public.profiles
  WHERE device_id = p_device_id
    AND user_id IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  v_current_credits := public.recalculate_profile_credits(v_profile_id);

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
    v_profile_id,
    'usage',
    -1,
    'Arazi analizi'
  );

  PERFORM public.recalculate_profile_credits(v_profile_id);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_promo_code(p_device_id text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_promo_code record;
  v_profile_id uuid;
  v_profile_device_id text;
  v_recent_promo_count integer;
  v_credits integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Giriş yapmanız gerekiyor');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz cihaz kimliği');
  END IF;

  IF p_code IS NULL
     OR LENGTH(p_code) > 20
     OR LENGTH(p_code) < 3
     OR NOT p_code ~ '^[A-Za-z0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  SELECT id, COALESCE(device_id, p_device_id)
  INTO v_profile_id, v_profile_device_id
  FROM public.profiles
  WHERE user_id = v_uid OR id = v_uid OR device_id = p_device_id
  ORDER BY CASE WHEN user_id = v_uid OR id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profil bulunamadı');
  END IF;

  v_profile_device_id := COALESCE(v_profile_device_id, p_device_id);

  SELECT COUNT(*)
  INTO v_recent_promo_count
  FROM public.promo_code_usages
  WHERE device_id = v_profile_device_id
    AND created_at > now() - interval '1 hour';

  IF v_recent_promo_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Çok fazla deneme. Lütfen biraz bekleyin.');
  END IF;

  SELECT *
  INTO v_promo_code
  FROM public.promo_codes
  WHERE UPPER(code) = UPPER(p_code)
  LIMIT 1;

  IF v_promo_code.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.promo_code_usages
    WHERE promo_code_id = v_promo_code.id
      AND device_id = v_profile_device_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyon kodunu zaten kullandınız');
  END IF;

  UPDATE public.profiles
  SET device_id = v_profile_device_id,
      user_id = COALESCE(user_id, v_uid),
      updated_at = now()
  WHERE id = v_profile_id;

  INSERT INTO public.promo_code_usages (
    promo_code_id,
    device_id
  )
  VALUES (
    v_promo_code.id,
    v_profile_device_id
  );

  UPDATE public.promo_codes
  SET usage_count = usage_count + 1
  WHERE id = v_promo_code.id;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    description
  )
  VALUES (
    v_profile_id,
    'purchase',
    v_promo_code.credits,
    'Promosyon kodu: ' || v_promo_code.code
  );

  v_credits := public.recalculate_profile_credits(v_profile_id);

  RETURN json_build_object(
    'success', true,
    'credits', v_promo_code.credits,
    'balance', v_credits
  );
END;
$$;

INSERT INTO public.promo_codes (
  code,
  credits,
  is_unlimited
)
VALUES (
  'TEST2026',
  2,
  true
)
ON CONFLICT (code) DO UPDATE
SET credits = 2,
    is_unlimited = true;

WITH user_profiles AS (
  SELECT DISTINCT p.id AS profile_id
  FROM public.profiles p
  WHERE p.user_id IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM auth.users u
       WHERE u.id = p.id
     )
),
missing_signup_bonus AS (
  SELECT up.profile_id
  FROM user_profiles up
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions ct
    WHERE ct.user_id = up.profile_id
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

REVOKE EXECUTE ON FUNCTION public.get_or_create_device_profile(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credit_by_device(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_promo_code(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_profile_credits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.deduct_credit_by_device(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
