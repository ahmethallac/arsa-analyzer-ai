-- Add device_id column to profiles table for device-based identification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_id TEXT UNIQUE;

-- Create index for faster device_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);

-- Update RLS policies to allow device-based access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Allow anyone to view profiles by device_id
CREATE POLICY "Anyone can view profiles by device_id" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Allow anyone to insert profiles (for device registration)
CREATE POLICY "Anyone can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update their own profile by device_id
CREATE POLICY "Anyone can update profiles by device_id" 
ON public.profiles 
FOR UPDATE 
USING (true);

-- Update deduct_credit function to work with device_id
CREATE OR REPLACE FUNCTION public.deduct_credit_by_device(p_device_id TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_current_credits INTEGER;
BEGIN
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
$$;

-- Function to get or create profile by device_id
CREATE OR REPLACE FUNCTION public.get_or_create_device_profile(p_device_id TEXT)
RETURNS TABLE(
  id UUID,
  device_id TEXT,
  credits INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_credits INTEGER;
  v_created_at TIMESTAMPTZ;
BEGIN
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
$$;