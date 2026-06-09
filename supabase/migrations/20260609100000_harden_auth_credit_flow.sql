-- Harden final auth, credit, and promo flow.
-- This is safe to run after the previous repair scripts.

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
      'Hos geldin bonusu - 1 ucretsiz sorgu'
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
  v_device_profile_user_id uuid;
  v_user_profile_id uuid;
  v_credits integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_device_id');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(v_uid::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));

  SELECT id, user_id
  INTO v_device_profile_id, v_device_profile_user_id
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id = v_uid OR id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE id = v_uid OR user_id = v_uid
  ORDER BY CASE WHEN id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL
       AND (v_device_profile_user_id IS NULL OR v_device_profile_user_id = v_uid) THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      IF v_device_profile_id IS NOT NULL AND v_device_profile_user_id <> v_uid THEN
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
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
      ON CONFLICT (id) DO UPDATE
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      IF v_device_profile_user_id IS NULL OR v_device_profile_user_id = v_uid THEN
        UPDATE public.credit_transactions
        SET user_id = v_user_profile_id
        WHERE user_id = v_device_profile_id
          AND type <> 'signup_bonus';

        DELETE FROM public.profiles
        WHERE id = v_device_profile_id;
      ELSE
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;
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
  v_device_profile_user_id uuid;
  v_current_credits integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(p_user_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));

  SELECT id, user_id
  INTO v_device_profile_id, v_device_profile_user_id
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id = p_user_id OR id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE id = p_user_id OR user_id = p_user_id
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL
       AND (v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id) THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = p_user_id,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      IF v_device_profile_id IS NOT NULL AND v_device_profile_user_id <> p_user_id THEN
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
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
        p_user_id,
        p_device_id,
        p_user_id,
        0,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = p_user_id,
          device_id = p_device_id,
          updated_at = now()
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      IF v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id THEN
        UPDATE public.credit_transactions
        SET user_id = v_user_profile_id
        WHERE user_id = v_device_profile_id
          AND type <> 'signup_bonus';

        DELETE FROM public.profiles
        WHERE id = v_device_profile_id;
      ELSE
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;
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
    RETURN json_build_object('success', false, 'error', 'Giris yapmaniz gerekiyor');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'Gecersiz cihaz kimligi');
  END IF;

  IF p_code IS NULL
     OR LENGTH(p_code) > 20
     OR LENGTH(p_code) < 3
     OR NOT p_code ~ '^[A-Za-z0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Gecersiz promosyon kodu');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(v_uid::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));
  PERFORM public.link_device_to_user(p_device_id);

  SELECT id, COALESCE(device_id, p_device_id)
  INTO v_profile_id, v_profile_device_id
  FROM public.profiles
  WHERE user_id = v_uid OR id = v_uid
  ORDER BY CASE WHEN id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profil bulunamadi');
  END IF;

  v_profile_device_id := COALESCE(v_profile_device_id, p_device_id);

  SELECT COUNT(*)
  INTO v_recent_promo_count
  FROM public.promo_code_usages
  WHERE device_id = v_profile_device_id
    AND created_at > now() - interval '1 hour';

  IF v_recent_promo_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Cok fazla deneme. Lutfen biraz bekleyin.');
  END IF;

  SELECT *
  INTO v_promo_code
  FROM public.promo_codes
  WHERE UPPER(code) = UPPER(p_code)
  LIMIT 1;

  IF v_promo_code.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Gecersiz promosyon kodu');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.promo_code_usages
    WHERE promo_code_id = v_promo_code.id
      AND device_id = v_profile_device_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyon kodunu zaten kullandiniz');
  END IF;

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
    'total_credits', v_credits
  );
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
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'Kullanici'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    0,
    now(),
    now(),
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE
  SET user_id = NEW.id,
      email = COALESCE(public.profiles.email, EXCLUDED.email),
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

WITH missing_auth_profiles AS (
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Kullanici') AS display_name,
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
    email = COALESCE(public.profiles.email, EXCLUDED.email),
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
  'Hos geldin bonusu - 1 ucretsiz sorgu'
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
REVOKE EXECUTE ON FUNCTION public.deduct_credit_for_user_device(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_profile_credits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_promo_code(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_device_profile(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credit_by_device(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credit_for_user_device(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
