-- Update the get_or_create_device_profile function to give 5 credits instead of 1
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
  
  -- Create new profile with 5 free credits (changed from 1)
  INSERT INTO profiles (id, device_id, credits, created_at, updated_at)
  VALUES (gen_random_uuid(), p_device_id, 5, now(), now())
  RETURNING profiles.id, profiles.credits, profiles.created_at INTO v_profile_id, v_credits, v_created_at;
  
  -- Log signup bonus (5 credits)
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'signup_bonus', 5, 'Hoş geldin kredisi');
  
  RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
END;
$function$;