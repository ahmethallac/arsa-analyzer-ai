
-- 1) Clean all existing promo codes
DELETE FROM public.promo_code_usages;
DELETE FROM public.promo_codes;

-- 2) Roles system
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can see own roles" ON public.user_roles;
CREATE POLICY "users can see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3) Auto-assign admin role for the whitelist email
CREATE OR REPLACE FUNCTION public.assign_admin_if_whitelisted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'ahmethallaccom@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_admin_if_whitelisted();

-- Backfill: if the admin user already exists, ensure role is set
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'ahmethallaccom@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Update deduct_credit_for_user_device: admin bypass
CREATE OR REPLACE FUNCTION public.deduct_credit_for_user_device(p_user_id uuid, p_device_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_profile_id uuid;
  v_device_profile_id uuid;
  v_device_profile_user_id uuid;
  v_current_credits integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN RETURN false; END IF;

  -- Admin bypass: no credit deduction
  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(p_user_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));

  SELECT id, user_id INTO v_device_profile_id, v_device_profile_user_id
  FROM public.profiles WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id = p_user_id OR id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1 FOR UPDATE;

  SELECT id INTO v_user_profile_id
  FROM public.profiles WHERE id = p_user_id OR user_id = p_user_id
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1 FOR UPDATE;

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL AND (v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id) THEN
      v_user_profile_id := v_device_profile_id;
      UPDATE public.profiles SET user_id = p_user_id, device_id = p_device_id, updated_at = now() WHERE id = v_user_profile_id;
    ELSE
      IF v_device_profile_id IS NOT NULL AND v_device_profile_user_id <> p_user_id THEN
        UPDATE public.profiles SET device_id = NULL, updated_at = now() WHERE id = v_device_profile_id;
      END IF;
      INSERT INTO public.profiles (id, device_id, user_id, credits, created_at, updated_at)
      VALUES (p_user_id, p_device_id, p_user_id, 0, now(), now())
      ON CONFLICT (id) DO UPDATE SET user_id = p_user_id, device_id = p_device_id, updated_at = now()
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      IF v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id THEN
        UPDATE public.credit_transactions SET user_id = v_user_profile_id
        WHERE user_id = v_device_profile_id AND type <> 'signup_bonus';
        DELETE FROM public.profiles WHERE id = v_device_profile_id;
      ELSE
        UPDATE public.profiles SET device_id = NULL, updated_at = now() WHERE id = v_device_profile_id;
      END IF;
    END IF;
    UPDATE public.profiles SET user_id = p_user_id, device_id = p_device_id, updated_at = now() WHERE id = v_user_profile_id;
  END IF;

  PERFORM public.ensure_signup_bonus(v_user_profile_id);
  v_current_credits := public.get_effective_credit_balance_for_device(v_user_profile_id, p_device_id);

  IF v_current_credits < 1 THEN RETURN false; END IF;

  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (v_user_profile_id, 'usage', -1, 'Arazi analizi');

  INSERT INTO public.device_free_credit_usage (device_id, profile_id, consumed_at)
  VALUES (p_device_id, v_user_profile_id, now())
  ON CONFLICT (device_id) DO NOTHING;

  PERFORM public.recalculate_profile_credits(v_user_profile_id);
  RETURN true;
END;
$function$;

-- 5) Admin RPC functions

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  current_credits integer,
  total_purchased integer,
  report_count integer,
  is_admin boolean,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.display_name,
    COALESCE(p.credits, 0),
    COALESCE((SELECT SUM(amount)::int FROM public.credit_transactions ct WHERE ct.user_id = p.id AND ct.type = 'purchase' AND ct.amount > 0), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.analysis_reports ar WHERE ar.user_id = u.id), 0),
    public.has_role(u.id, 'admin'),
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id OR p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_reports()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  title text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT ar.id, ar.user_id, u.email::text, ar.title, ar.created_at, ar.expires_at
  FROM public.analysis_reports ar
  LEFT JOIN auth.users u ON u.id = ar.user_id
  ORDER BY ar.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_reports() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_credits(p_user_id uuid, p_amount integer, p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_total integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RETURN json_build_object('success', false, 'error', 'invalid_amount'); END IF;

  SELECT id INTO v_profile_id FROM public.profiles
  WHERE id = p_user_id OR user_id = p_user_id
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END, updated_at DESC LIMIT 1;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (id, user_id, credits, created_at, updated_at)
    VALUES (p_user_id, p_user_id, 0, now(), now())
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_profile_id;
    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (v_profile_id, p_amount, 'purchase', COALESCE(p_note, 'Admin tarafından eklendi'));

  v_total := public.recalculate_profile_credits(v_profile_id);
  RETURN json_build_object('success', true, 'total_credits', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_credits(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_credits(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_profile_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_user_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'cannot_delete_self'); END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE id = p_user_id OR user_id = p_user_id;
  IF v_profile_id IS NOT NULL THEN
    DELETE FROM public.credit_transactions WHERE user_id = v_profile_id;
    DELETE FROM public.profiles WHERE id = v_profile_id;
  END IF;
  DELETE FROM public.analysis_reports WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_promo_code(p_code text, p_credits integer, p_is_unlimited boolean DEFAULT true)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_code IS NULL OR NOT p_code ~ '^[A-Za-z0-9]{3,20}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_credits');
  END IF;

  INSERT INTO public.promo_codes (code, credits, is_unlimited)
  VALUES (upper(p_code), p_credits, COALESCE(p_is_unlimited, true))
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'id', v_id);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'code_exists');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_promo_code(text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_promo_code(text, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_promo_codes()
RETURNS TABLE (id uuid, code text, credits integer, is_unlimited boolean, usage_count integer, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT pc.id, pc.code, pc.credits, pc.is_unlimited, pc.usage_count, pc.created_at
  FROM public.promo_codes pc
  ORDER BY pc.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promo_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_codes() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_promo_code(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.promo_code_usages WHERE promo_code_id = p_id;
  DELETE FROM public.promo_codes WHERE id = p_id;
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_promo_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_promo_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_promo_usages(p_promo_code_id uuid)
RETURNS TABLE (id uuid, device_id text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT pu.id, pu.device_id, pu.created_at
  FROM public.promo_code_usages pu
  WHERE pu.promo_code_id = p_promo_code_id
  ORDER BY pu.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promo_usages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_usages(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin'); $$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
