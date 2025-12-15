-- Create promo_codes table
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL DEFAULT 2,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create promo_code_usages table to track which devices used which codes
CREATE TABLE public.promo_code_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, device_id)
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read promo codes (needed to validate)
CREATE POLICY "Anyone can view promo codes"
ON public.promo_codes FOR SELECT
USING (true);

-- Allow anyone to view usages (needed to check if already used)
CREATE POLICY "Anyone can view promo code usages"
ON public.promo_code_usages FOR SELECT
USING (true);

-- Allow anyone to insert usages
CREATE POLICY "Anyone can insert promo code usages"
ON public.promo_code_usages FOR INSERT
WITH CHECK (true);

-- Create function to apply promo code
CREATE OR REPLACE FUNCTION public.apply_promo_code(p_device_id TEXT, p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo_code RECORD;
  v_profile_id UUID;
  v_already_used BOOLEAN;
BEGIN
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
  VALUES (v_profile_id, 'purchase', v_promo_code.credits, 'Promosyon kodu: ' || v_promo_code.code);
  
  RETURN json_build_object('success', true, 'credits', v_promo_code.credits);
END;
$$;

-- Insert the test promo code
INSERT INTO public.promo_codes (code, credits, is_unlimited) VALUES ('TEST2024', 2, true);