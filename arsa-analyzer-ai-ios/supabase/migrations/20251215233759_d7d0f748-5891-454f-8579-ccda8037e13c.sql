-- Allow device-based profiles without requiring an auth.users row
-- This fixes "Profil bulunamadı" in device/RPC flows.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;