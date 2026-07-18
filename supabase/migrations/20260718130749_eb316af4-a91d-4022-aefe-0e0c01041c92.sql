
-- 1. Extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. analysis_reports table
CREATE TABLE IF NOT EXISTS public.analysis_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_json JSONB,
  result_json JSONB NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 days')
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_user_id ON public.analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_expires_at ON public.analysis_reports(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_reports TO authenticated;
GRANT ALL ON public.analysis_reports TO service_role;

ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own non-expired reports" ON public.analysis_reports;
CREATE POLICY "Users view own non-expired reports"
  ON public.analysis_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND expires_at > now());

DROP POLICY IF EXISTS "Users insert own reports" ON public.analysis_reports;
CREATE POLICY "Users insert own reports"
  ON public.analysis_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own reports" ON public.analysis_reports;
CREATE POLICY "Users delete own reports"
  ON public.analysis_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages reports" ON public.analysis_reports;
CREATE POLICY "Service role manages reports"
  ON public.analysis_reports FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3. Cron job for expiring reports (daily at 03:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-analysis-reports') THEN
    PERFORM cron.unschedule('delete-expired-analysis-reports');
  END IF;
END $$;

SELECT cron.schedule(
  'delete-expired-analysis-reports',
  '0 3 * * *',
  $$DELETE FROM public.analysis_reports WHERE expires_at < now();$$
);

-- 4. Remove free credit logic

-- handle_new_user: no signup bonus anymore
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, display_name, avatar_url, credits, created_at, updated_at, user_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'Kullanici'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    0,
    now(),
    now(),
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE
  SET user_id = NEW.id,
      email = COALESCE(public.profiles.email, EXCLUDED.email),
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
      updated_at = now();
  RETURN NEW;
END;
$function$;

-- ensure_signup_bonus: no-op now (kept for callers)
CREATE OR REPLACE FUNCTION public.ensure_signup_bonus(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN;
END;
$function$;

-- ensure_profile_credit_floor: keep existing floor logic but never insert signup bonus
CREATE OR REPLACE FUNCTION public.ensure_profile_credit_floor(p_profile_id uuid, p_min_credits integer DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance integer;
  v_floor integer := GREATEST(COALESCE(p_min_credits, 0), 0);
  v_adjustment integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
  INTO v_balance
  FROM public.credit_transactions
  WHERE user_id = p_profile_id;

  IF v_floor > COALESCE(v_balance, 0) THEN
    v_adjustment := v_floor - COALESCE(v_balance, 0);
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (p_profile_id, v_adjustment, 'purchase', 'Kredi duzeltme - profil baglama');
  END IF;

  RETURN public.recalculate_profile_credits(p_profile_id);
END;
$function$;

-- get_or_create_device_profile: 0 credits for new devices
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
  IF p_device_id IS NULL OR LENGTH(p_device_id) < 10 OR LENGTH(p_device_id) > 100 THEN
    RAISE EXCEPTION 'Invalid device_id length';
  END IF;
  IF NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RAISE EXCEPTION 'Invalid device_id format';
  END IF;

  SELECT p.id, p.credits, p.created_at INTO v_profile_id, v_credits, v_created_at
  FROM profiles p WHERE p.device_id = p_device_id;

  IF v_profile_id IS NOT NULL THEN
    RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
    RETURN;
  END IF;

  INSERT INTO profiles (id, device_id, credits, created_at, updated_at)
  VALUES (gen_random_uuid(), p_device_id, 0, now(), now())
  RETURNING profiles.id, profiles.credits, profiles.created_at INTO v_profile_id, v_credits, v_created_at;

  RETURN QUERY SELECT v_profile_id, p_device_id, v_credits, v_created_at;
END;
$function$;
