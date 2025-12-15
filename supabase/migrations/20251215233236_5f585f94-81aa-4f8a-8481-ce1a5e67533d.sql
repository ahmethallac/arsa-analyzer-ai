-- Fix device_id validation regex to be more permissive
-- Current device IDs have format: device_mj7m600f_ujt0wavdtdm (timestamp + random alphanumeric)

CREATE OR REPLACE FUNCTION public.get_or_create_device_profile(p_device_id text)
 RETURNS TABLE(id uuid, device_id text, credits integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id UUID;
  v_credits INTEGER;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Validate device_id format (more permissive pattern)
  IF p_device_id IS NULL OR LENGTH(p_device_id) < 10 OR LENGTH(p_device_id) > 100 THEN
    RAISE EXCEPTION 'Invalid device_id length';
  END IF;
  
  -- Check device_id starts with 'device_' and contains only safe characters
  IF NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RAISE EXCEPTION 'Invalid device_id format';
  END IF;
  
  -- Try to find existing profile
  SELECT p.id, p.credits, p.created_at INTO v_profile_id, v_credits, v_created_at
  FROM profiles p
  WHERE p.device_id = p_device_id;
  
  IF v_profile_id IS NOT NULL THEN
    RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
    RETURN;
  END IF;
  
  -- Create new profile with 1 free credit
  INSERT INTO profiles (id, device_id, credits, created_at, updated_at)
  VALUES (gen_random_uuid(), p_device_id, 1, now(), now())
  RETURNING profiles.id, profiles.credits, profiles.created_at INTO v_profile_id, v_credits, v_created_at;
  
  -- Log signup bonus
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'signup_bonus', 1, 'Hoş geldin kredisi');
  
  RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
END;
$function$;

-- Update deduct_credit_by_device with same permissive pattern
CREATE OR REPLACE FUNCTION public.deduct_credit_by_device(p_device_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id UUID;
  v_current_credits INTEGER;
BEGIN
  -- Validate device_id format
  IF p_device_id IS NULL OR LENGTH(p_device_id) < 10 OR LENGTH(p_device_id) > 100 THEN
    RETURN false;
  END IF;
  
  IF NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;
  
  -- Get profile by device_id
  SELECT id, credits INTO v_profile_id, v_current_credits
  FROM profiles
  WHERE device_id = p_device_id;
  
  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_current_credits < 1 THEN
    RETURN false;
  END IF;
  
  -- Deduct credit
  UPDATE profiles
  SET credits = credits - 1, updated_at = now()
  WHERE id = v_profile_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'usage', -1, 'Arazi analizi');
  
  RETURN true;
END;
$function$;

-- Update apply_promo_code with same permissive pattern
CREATE OR REPLACE FUNCTION public.apply_promo_code(p_device_id text, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_promo_code RECORD;
  v_profile_id UUID;
  v_already_used BOOLEAN;
  v_recent_promo_count INTEGER;
BEGIN
  -- Validate device_id format
  IF p_device_id IS NULL OR LENGTH(p_device_id) < 10 OR LENGTH(p_device_id) > 100 THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz cihaz kimliği');
  END IF;
  
  IF NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz cihaz kimliği formatı');
  END IF;
  
  -- Validate promo code format (3-20 chars, alphanumeric only)
  IF p_code IS NULL OR LENGTH(p_code) > 20 OR LENGTH(p_code) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;
  
  IF NOT p_code ~ '^[A-Za-z0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu formatı');
  END IF;
  
  -- Rate limiting: Check how many promo codes this device has used in the last hour
  SELECT COUNT(*) INTO v_recent_promo_count
  FROM promo_code_usages
  WHERE device_id = p_device_id
    AND created_at > now() - interval '1 hour';
  
  IF v_recent_promo_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Çok fazla deneme. Lütfen biraz bekleyin.');
  END IF;
  
  -- Find the promo code
  SELECT * INTO v_promo_code FROM promo_codes WHERE UPPER(code) = UPPER(p_code);
  
  IF v_promo_code.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz promosyon kodu');
  END IF;
  
  -- Check if device already used this code
  SELECT EXISTS(
    SELECT 1 FROM promo_code_usages 
    WHERE promo_code_id = v_promo_code.id AND device_id = p_device_id
  ) INTO v_already_used;
  
  IF v_already_used THEN
    RETURN json_build_object('success', false, 'error', 'Bu promosyon kodunu zaten kullandınız');
  END IF;
  
  -- Get profile by device_id
  SELECT id INTO v_profile_id FROM profiles WHERE device_id = p_device_id;
  
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profil bulunamadı');
  END IF;
  
  -- Add credits to profile
  UPDATE profiles SET credits = credits + v_promo_code.credits, updated_at = now() WHERE id = v_profile_id;
  
  -- Record the usage
  INSERT INTO promo_code_usages (promo_code_id, device_id) VALUES (v_promo_code.id, p_device_id);
  
  -- Increment usage count
  UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = v_promo_code.id;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'purchase', v_promo_code.credits, 'Promosyon kodu kullanıldı');
  
  RETURN json_build_object('success', true, 'credits', v_promo_code.credits);
END;
$function$;