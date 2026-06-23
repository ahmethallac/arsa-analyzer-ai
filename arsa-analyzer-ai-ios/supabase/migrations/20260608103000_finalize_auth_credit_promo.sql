-- Finalize the production auth/credit rules:
-- 1 free credit per member, TEST2026 gives 2 credits, and promo/device RPCs stay server-controlled.

CREATE OR REPLACE FUNCTION public.get_or_create_device_profile(p_device_id text)
RETURNS TABLE(id uuid, device_id text, credits integer, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_credits integer;
  v_created_at timestamptz;
BEGIN
  IF p_device_id IS NULL OR LENGTH(p_device_id) < 10 OR LENGTH(p_device_id) > 100 THEN
    RAISE EXCEPTION 'Invalid device_id length';
  END IF;

  IF NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RAISE EXCEPTION 'Invalid device_id format';
  END IF;

  SELECT p.id, p.credits, p.created_at
  INTO v_profile_id, v_credits, v_created_at
  FROM public.profiles p
  WHERE p.device_id = p_device_id;

  IF v_profile_id IS NOT NULL THEN
    RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, device_id, credits, created_at, updated_at)
  VALUES (gen_random_uuid(), p_device_id, 1, now(), now())
  RETURNING profiles.id, profiles.credits, profiles.created_at
  INTO v_profile_id, v_credits, v_created_at;

  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'signup_bonus', 1, 'Hoş geldin bonusu - 1 ücretsiz sorgu');

  RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
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
  v_device_credits integer;
  v_user_profile_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_device_id');
  END IF;

  SELECT id, credits
  INTO v_device_profile_id, v_device_credits
  FROM public.profiles
  WHERE device_id = p_device_id;

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE user_id = v_uid OR id = v_uid
  LIMIT 1;

  IF v_user_profile_id IS NOT NULL THEN
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      UPDATE public.profiles
      SET credits = GREATEST(credits, COALESCE(v_device_credits, 0), 1),
          user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;

      UPDATE public.credit_transactions
      SET user_id = v_user_profile_id
      WHERE user_id = v_device_profile_id
        AND type <> 'signup_bonus';

      DELETE FROM public.profiles WHERE id = v_device_profile_id;
    ELSE
      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          credits = GREATEST(credits, 1),
          updated_at = now()
      WHERE id = v_user_profile_id;
    END IF;

    RETURN json_build_object('success', true, 'profile_id', v_user_profile_id);
  END IF;

  IF v_device_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id = v_uid,
        credits = GREATEST(credits, 1),
        updated_at = now()
    WHERE id = v_device_profile_id;

    RETURN json_build_object('success', true, 'profile_id', v_device_profile_id);
  END IF;

  INSERT INTO public.profiles (id, device_id, user_id, credits, created_at, updated_at)
  VALUES (gen_random_uuid(), p_device_id, v_uid, 1, now(), now())
  RETURNING id INTO v_user_profile_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (v_user_profile_id, 'signup_bonus', 1, 'Hoş geldin bonusu - 1 ücretsiz sorgu');

  RETURN json_build_object('success', true, 'profile_id', v_user_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_promo_code(p_device_id text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo_code record;
  v_profile_id uuid;
  v_profile_device_id text;
  v_already_used boolean;
  v_recent_promo_count integer;
  v_uid uuid := auth.uid();
BEGIN
  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz cihaz kimliği');
  END IF;

  IF p_code IS NULL OR LENGTH(p_code) > 20 OR LENGTH(p_code) < 3 OR NOT p_code ~ '^[A-Za-z0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT id, COALESCE(device_id, p_device_id)
    INTO v_profile_id, v_profile_device_id
    FROM public.profiles
    WHERE user_id = v_uid OR id = v_uid OR device_id = p_device_id
    ORDER BY CASE WHEN user_id = v_uid OR id = v_uid THEN 0 ELSE 1 END
    LIMIT 1;
  ELSE
    SELECT id, device_id
    INTO v_profile_id, v_profile_device_id
    FROM public.profiles
    WHERE device_id = p_device_id
    LIMIT 1;
  END IF;

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
  WHERE UPPER(code) = UPPER(p_code);

  IF v_promo_code.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.promo_code_usages
    WHERE promo_code_id = v_promo_code.id
      AND device_id = v_profile_device_id
  )
  INTO v_already_used;

  IF v_already_used THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyon kodunu zaten kullandınız');
  END IF;

  UPDATE public.profiles
  SET credits = credits + v_promo_code.credits,
      device_id = v_profile_device_id,
      user_id = COALESCE(user_id, v_uid),
      updated_at = now()
  WHERE id = v_profile_id;

  INSERT INTO public.promo_code_usages (promo_code_id, device_id)
  VALUES (v_promo_code.id, v_profile_device_id);

  UPDATE public.promo_codes
  SET usage_count = usage_count + 1
  WHERE id = v_promo_code.id;

  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'purchase', v_promo_code.credits, 'Promosyon kodu: ' || v_promo_code.code);

  RETURN json_build_object('success', true, 'credits', v_promo_code.credits);
END;
$$;

INSERT INTO public.promo_codes (code, credits, is_unlimited)
VALUES ('TEST2026', 2, true)
ON CONFLICT (code) DO UPDATE
SET credits = 2,
    is_unlimited = true;

REVOKE EXECUTE ON FUNCTION public.get_or_create_device_profile(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_promo_code(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_device_profile(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;
