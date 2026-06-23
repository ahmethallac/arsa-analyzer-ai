
-- Add user_id link to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- Allow authenticated users to read their own profile (for client-side checks)
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.credit_transactions TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Link a device profile to the currently authenticated user.
-- If the user already has a profile, merge credits and transactions, then delete the device-only profile.
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

  SELECT id, credits INTO v_device_profile_id, v_device_credits
  FROM profiles WHERE device_id = p_device_id;

  SELECT id INTO v_user_profile_id
  FROM profiles WHERE user_id = v_uid LIMIT 1;

  -- Case A: user already has a profile
  IF v_user_profile_id IS NOT NULL THEN
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      -- Merge: add device credits to user profile, move transactions, delete device profile
      UPDATE profiles
        SET credits = credits + COALESCE(v_device_credits, 0), updated_at = now()
        WHERE id = v_user_profile_id;
      UPDATE credit_transactions SET user_id = v_user_profile_id WHERE user_id = v_device_profile_id;
      DELETE FROM profiles WHERE id = v_device_profile_id;
    END IF;
    -- Ensure the user profile is bound to this device for future calls
    UPDATE profiles SET device_id = p_device_id, updated_at = now() WHERE id = v_user_profile_id;
    RETURN json_build_object('success', true, 'profile_id', v_user_profile_id);
  END IF;

  -- Case B: no user profile yet
  IF v_device_profile_id IS NOT NULL THEN
    -- Promote device profile to user-bound profile
    UPDATE profiles SET user_id = v_uid, updated_at = now() WHERE id = v_device_profile_id;
    RETURN json_build_object('success', true, 'profile_id', v_device_profile_id);
  END IF;

  -- No profile at all -> create one
  INSERT INTO profiles (device_id, user_id, credits)
  VALUES (p_device_id, v_uid, 0)
  RETURNING id INTO v_user_profile_id;
  RETURN json_build_object('success', true, 'profile_id', v_user_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;

-- Update apply_promo_code to require authentication
CREATE OR REPLACE FUNCTION public.apply_promo_code(p_device_id text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo_code RECORD;
  v_profile_id uuid;
  v_already_used boolean;
  v_recent_promo_count integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Promosyon kodu kullanmak için giriş yapmalısınız');
  END IF;

  IF p_code IS NULL OR LENGTH(p_code) > 20 OR LENGTH(p_code) < 3 OR NOT p_code ~ '^[A-Za-z0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_uid LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profil bulunamadı');
  END IF;

  -- Rate limiting on this user's profile
  SELECT COUNT(*) INTO v_recent_promo_count
  FROM promo_code_usages u
  JOIN profiles p ON p.device_id = u.device_id
  WHERE p.id = v_profile_id AND u.created_at > now() - interval '1 hour';

  IF v_recent_promo_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Çok fazla deneme. Lütfen biraz bekleyin.');
  END IF;

  SELECT * INTO v_promo_code FROM promo_codes WHERE UPPER(code) = UPPER(p_code);
  IF v_promo_code.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM promo_code_usages u
    JOIN profiles p ON p.device_id = u.device_id
    WHERE u.promo_code_id = v_promo_code.id AND p.id = v_profile_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyon kodunu zaten kullandınız');
  END IF;

  UPDATE profiles SET credits = credits + v_promo_code.credits, updated_at = now() WHERE id = v_profile_id;

  INSERT INTO promo_code_usages (promo_code_id, device_id)
  VALUES (v_promo_code.id, (SELECT device_id FROM profiles WHERE id = v_profile_id));

  UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = v_promo_code.id;

  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'purchase', v_promo_code.credits, 'Promosyon kodu kullanıldı');

  RETURN json_build_object('success', true, 'credits', v_promo_code.credits);
END;
$$;

-- Account deletion: deletes auth user (cascades to profile via FK) and the user's transactions/profile data
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_uid;
  IF v_profile_id IS NOT NULL THEN
    DELETE FROM credit_transactions WHERE user_id = v_profile_id;
    DELETE FROM profiles WHERE id = v_profile_id;
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
