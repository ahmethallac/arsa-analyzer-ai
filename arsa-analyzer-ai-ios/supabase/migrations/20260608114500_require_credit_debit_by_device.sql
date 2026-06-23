-- Make credit debit deterministic for analyze-land.
-- The Edge Function must receive true from this RPC before it generates an analysis.

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
  IF p_device_id IS NULL OR LENGTH(p_device_id) < 10 OR LENGTH(p_device_id) > 100 THEN
    RETURN false;
  END IF;

  IF NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;

  SELECT id, credits
  INTO v_profile_id, v_current_credits
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_profile_id IS NULL OR COALESCE(v_current_credits, 0) < 1 THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET credits = credits - 1,
      updated_at = now()
  WHERE id = v_profile_id
    AND credits >= 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (v_profile_id, 'usage', -1, 'Arazi analizi');

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_credit_by_device(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credit_by_device(text) TO service_role;
