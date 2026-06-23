-- Enforce the signup/free analysis credit once per device, even across accounts.

CREATE TABLE IF NOT EXISTS public.device_free_credit_usage (
  device_id text PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  consumed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.device_free_credit_usage ENABLE ROW LEVEL SECURITY;

INSERT INTO public.device_free_credit_usage (
  device_id,
  profile_id,
  consumed_at
)
SELECT
  p.device_id,
  p.id,
  MIN(ct.created_at)
FROM public.profiles p
JOIN public.credit_transactions ct
  ON ct.user_id = p.id
WHERE p.device_id IS NOT NULL
  AND ct.type = 'usage'
  AND ct.amount < 0
GROUP BY p.device_id, p.id
ON CONFLICT (device_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_effective_credit_balance_for_device(
  p_profile_id uuid,
  p_device_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_credits integer;
  v_signup_credits integer;
  v_consumed_profile_id uuid;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN 0;
  END IF;

  v_total_credits := public.recalculate_profile_credits(p_profile_id);

  SELECT COALESCE(SUM(amount), 0)::integer
  INTO v_signup_credits
  FROM public.credit_transactions
  WHERE user_id = p_profile_id
    AND type = 'signup_bonus'
    AND amount > 0;

  SELECT profile_id
  INTO v_consumed_profile_id
  FROM public.device_free_credit_usage
  WHERE device_id = p_device_id;

  IF v_consumed_profile_id IS NOT NULL AND v_consumed_profile_id <> p_profile_id THEN
    RETURN GREATEST(COALESCE(v_total_credits, 0) - COALESCE(v_signup_credits, 0), 0);
  END IF;

  IF v_consumed_profile_id IS NULL
     AND EXISTS (
       SELECT 1
       FROM public.device_free_credit_usage
       WHERE device_id = p_device_id
     ) THEN
    RETURN GREATEST(COALESCE(v_total_credits, 0) - COALESCE(v_signup_credits, 0), 0);
  END IF;

  RETURN GREATEST(COALESCE(v_total_credits, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_device_to_user(p_device_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_device_profile_id uuid;
  v_device_profile_user_id uuid;
  v_device_profile_credits integer;
  v_user_profile_id uuid;
  v_user_profile_credits integer;
  v_credit_floor integer;
  v_credits integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_device_id');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(v_uid::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));

  SELECT id, user_id, credits
  INTO v_device_profile_id, v_device_profile_user_id, v_device_profile_credits
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id = v_uid OR id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT id, credits
  INTO v_user_profile_id, v_user_profile_credits
  FROM public.profiles
  WHERE id = v_uid OR user_id = v_uid
  ORDER BY CASE WHEN id = v_uid THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  v_credit_floor := GREATEST(
    COALESCE(v_device_profile_credits, 0),
    COALESCE(v_user_profile_credits, 0)
  );

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL
       AND (v_device_profile_user_id IS NULL OR v_device_profile_user_id = v_uid) THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      IF v_device_profile_id IS NOT NULL AND v_device_profile_user_id <> v_uid THEN
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;

      INSERT INTO public.profiles (
        id,
        device_id,
        user_id,
        credits,
        created_at,
        updated_at
      )
      VALUES (
        v_uid,
        p_device_id,
        v_uid,
        v_credit_floor,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = v_uid,
          device_id = p_device_id,
          credits = GREATEST(public.profiles.credits, EXCLUDED.credits),
          updated_at = now()
      RETURNING id, credits INTO v_user_profile_id, v_user_profile_credits;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      IF v_device_profile_user_id IS NULL OR v_device_profile_user_id = v_uid THEN
        UPDATE public.credit_transactions
        SET user_id = v_user_profile_id
        WHERE user_id = v_device_profile_id
          AND type <> 'signup_bonus';

        DELETE FROM public.profiles
        WHERE id = v_device_profile_id;
      ELSE
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;
    END IF;

    UPDATE public.profiles
    SET user_id = v_uid,
        device_id = p_device_id,
        credits = GREATEST(credits, v_credit_floor),
        updated_at = now()
    WHERE id = v_user_profile_id;
  END IF;

  PERFORM public.ensure_profile_credit_floor(v_user_profile_id, v_credit_floor);
  v_credits := public.get_effective_credit_balance_for_device(v_user_profile_id, p_device_id);

  RETURN json_build_object(
    'success', true,
    'profile_id', v_user_profile_id,
    'device_id', p_device_id,
    'credits', v_credits
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_balance_for_user_device(
  p_user_id uuid,
  p_device_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_profile_id uuid;
  v_user_profile_credits integer;
  v_device_profile_id uuid;
  v_device_profile_user_id uuid;
  v_device_profile_credits integer;
  v_credit_floor integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(p_user_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));

  SELECT id, user_id, credits
  INTO v_device_profile_id, v_device_profile_user_id, v_device_profile_credits
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id = p_user_id OR id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT id, credits
  INTO v_user_profile_id, v_user_profile_credits
  FROM public.profiles
  WHERE id = p_user_id OR user_id = p_user_id
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  v_credit_floor := GREATEST(
    COALESCE(v_device_profile_credits, 0),
    COALESCE(v_user_profile_credits, 0)
  );

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL
       AND (v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id) THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = p_user_id,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      INSERT INTO public.profiles (
        id,
        device_id,
        user_id,
        credits,
        created_at,
        updated_at
      )
      VALUES (
        p_user_id,
        p_device_id,
        p_user_id,
        v_credit_floor,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = p_user_id,
          device_id = p_device_id,
          credits = GREATEST(public.profiles.credits, EXCLUDED.credits),
          updated_at = now()
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      IF v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id THEN
        UPDATE public.credit_transactions
        SET user_id = v_user_profile_id
        WHERE user_id = v_device_profile_id
          AND type <> 'signup_bonus';

        DELETE FROM public.profiles
        WHERE id = v_device_profile_id;
      ELSE
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;
    END IF;

    UPDATE public.profiles
    SET user_id = p_user_id,
        device_id = p_device_id,
        credits = GREATEST(credits, v_credit_floor),
        updated_at = now()
    WHERE id = v_user_profile_id;
  END IF;

  PERFORM public.ensure_profile_credit_floor(v_user_profile_id, v_credit_floor);
  RETURN public.get_effective_credit_balance_for_device(v_user_profile_id, p_device_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_credit_for_user_device(
  p_user_id uuid,
  p_device_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_profile_id uuid;
  v_device_profile_id uuid;
  v_device_profile_user_id uuid;
  v_current_credits integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('arsa_user'), hashtext(p_user_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('arsa_device'), hashtext(p_device_id));

  SELECT id, user_id
  INTO v_device_profile_id, v_device_profile_user_id
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY CASE WHEN user_id = p_user_id OR id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE id = p_user_id OR user_id = p_user_id
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_user_profile_id IS NULL THEN
    IF v_device_profile_id IS NOT NULL
       AND (v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id) THEN
      v_user_profile_id := v_device_profile_id;

      UPDATE public.profiles
      SET user_id = p_user_id,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    ELSE
      IF v_device_profile_id IS NOT NULL AND v_device_profile_user_id <> p_user_id THEN
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;

      INSERT INTO public.profiles (
        id,
        device_id,
        user_id,
        credits,
        created_at,
        updated_at
      )
      VALUES (
        p_user_id,
        p_device_id,
        p_user_id,
        0,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET user_id = p_user_id,
          device_id = p_device_id,
          updated_at = now()
      RETURNING id INTO v_user_profile_id;
    END IF;
  ELSE
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      IF v_device_profile_user_id IS NULL OR v_device_profile_user_id = p_user_id THEN
        UPDATE public.credit_transactions
        SET user_id = v_user_profile_id
        WHERE user_id = v_device_profile_id
          AND type <> 'signup_bonus';

        DELETE FROM public.profiles
        WHERE id = v_device_profile_id;
      ELSE
        UPDATE public.profiles
        SET device_id = NULL,
            updated_at = now()
        WHERE id = v_device_profile_id;
      END IF;
    END IF;

    UPDATE public.profiles
    SET user_id = p_user_id,
        device_id = p_device_id,
        updated_at = now()
    WHERE id = v_user_profile_id;
  END IF;

  PERFORM public.ensure_signup_bonus(v_user_profile_id);
  v_current_credits := public.get_effective_credit_balance_for_device(v_user_profile_id, p_device_id);

  IF v_current_credits < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    description
  )
  VALUES (
    v_user_profile_id,
    'usage',
    -1,
    'Arazi analizi'
  );

  INSERT INTO public.device_free_credit_usage (
    device_id,
    profile_id,
    consumed_at
  )
  VALUES (
    p_device_id,
    v_user_profile_id,
    now()
  )
  ON CONFLICT (device_id) DO NOTHING;

  PERFORM public.recalculate_profile_credits(v_user_profile_id);

  RETURN true;
END;
$$;

REVOKE ALL ON public.device_free_credit_usage FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_effective_credit_balance_for_device(uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.link_device_to_user(text)
FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_credit_balance_for_user_device(uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.deduct_credit_for_user_device(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_effective_credit_balance_for_device(uuid, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.link_device_to_user(text)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_credit_balance_for_user_device(uuid, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.deduct_credit_for_user_device(uuid, text)
TO service_role;
