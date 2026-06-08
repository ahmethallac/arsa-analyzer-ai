-- Move device-account operations behind Edge Functions that use the service role.
-- Public clients must not read/write profile, credit, or promo usage tables directly.

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles by device_id" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can update profiles by device_id" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are accessed through RPC" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are inserted through RPC" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are updated through RPC" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.credit_transactions;

DROP POLICY IF EXISTS "Anyone can view promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Anyone can view promo code usages" ON public.promo_code_usages;
DROP POLICY IF EXISTS "Anyone can insert promo code usages" ON public.promo_code_usages;

DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Service role can manage promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Service role can manage promo code usages" ON public.promo_code_usages;

CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage credit transactions"
ON public.credit_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage promo codes"
ON public.promo_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage promo code usages"
ON public.promo_code_usages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE EXECUTE ON FUNCTION public.get_or_create_device_profile(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credit_by_device(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_promo_code(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_or_create_device_profile(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credit_by_device(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text) TO service_role;
