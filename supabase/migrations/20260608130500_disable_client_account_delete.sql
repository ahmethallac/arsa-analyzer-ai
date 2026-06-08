-- Account deletion must not be callable from the client because users could
-- repeatedly delete and recreate accounts to receive free credits.

REVOKE EXECUTE ON FUNCTION public.delete_my_account()
FROM PUBLIC, anon, authenticated;
