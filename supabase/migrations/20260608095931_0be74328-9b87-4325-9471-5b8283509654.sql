
-- Restrict deduct_credit_by_device: only service role (edge function) should call this
REVOKE ALL ON FUNCTION public.deduct_credit_by_device(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credit_by_device(text) TO service_role;

-- Restrict apply_promo_code: requires auth, so revoke from anon
REVOKE ALL ON FUNCTION public.apply_promo_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, text) TO authenticated, service_role;

-- Restrict delete_my_account: authenticated only
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Restrict link_device_to_user: authenticated only
REVOKE ALL ON FUNCTION public.link_device_to_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;

-- Legacy functions only used internally / by service role
REVOKE ALL ON FUNCTION public.deduct_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credit(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.add_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text) TO service_role;

-- get_or_create_device_profile must remain callable by anon (used for anonymous first-launch profile creation)
-- but make sure it's an explicit grant
GRANT EXECUTE ON FUNCTION public.get_or_create_device_profile(text) TO anon, authenticated, service_role;
