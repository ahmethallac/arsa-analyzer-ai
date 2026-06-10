-- Preserve credits while linking a device profile to an authenticated user.
-- A login/profile refresh must never reduce credits by itself.

CREATE OR REPLACE FUNCTION public.ensure_profile_credit_floor(
  p_profile_id uuid,
  p_min_credits integer DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_floor integer := GREATEST(COALESCE(p_min_credits, 0), 0);
  v_adjustment integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM 1
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE user_id = p_profile_id
      AND type = 'signup_bonus'
  ) THEN
    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      type,
      description
    )
    VALUES (
      p_profile_id,
      1,
      'signup_bonus',
      'Hos geldin bonusu - 1 ucretsiz sorgu'
    );
  END IF;

  SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::integer
  INTO v_balance
  FROM public.credit_transactions
  WHERE user_id = p_profile_id;

  IF v_floor > COALESCE(v_balance, 0) THEN
    v_adjustment := v_floor - COALESCE(v_balance, 0);

    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      type,
      description
    )
    VALUES (
      p_profile_id,
      v_adjustment,
      'purchase',
      'Kredi duzeltme - profil baglama'
    );
  END IF;

  RETURN public.recalculate_profile_credits(p_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_signup_bonus(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_credits integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT credits
  INTO v_stored_credits
  FROM public.profiles
  WHERE id = p_profile_id;

  PERFORM public.ensure_profile_credit_floor(p_profile_id, COALESCE(v_stored_credits, 0));
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

  v_credits := public.ensure_profile_credit_floor(v_user_profile_id, v_credit_floor);

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

  RETURN public.ensure_profile_credit_floor(v_user_profile_id, v_credit_floor);
END;
$$;

WITH profiles_without_usage AS (
  SELECT p.id, p.credits
  FROM public.profiles p
  WHERE COALESCE(p.credits, 0) < 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.credit_transactions ct
      WHERE ct.user_id = p.id
        AND ct.type = 'usage'
        AND ct.amount < 0
    )
)
INSERT INTO public.credit_transactions (
  user_id,
  amount,
  type,
  description
)
SELECT
  id,
  1,
  'signup_bonus',
  'Hos geldin bonusu - 1 ucretsiz sorgu'
FROM profiles_without_usage
WHERE NOT EXISTS (
  SELECT 1
  FROM public.credit_transactions ct
  WHERE ct.user_id = profiles_without_usage.id
    AND ct.type = 'signup_bonus'
);

DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  FOR v_profile_id IN
    SELECT id
    FROM public.profiles
  LOOP
    PERFORM public.ensure_profile_credit_floor(v_profile_id, 0);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_profile_credit_floor(uuid, integer)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.link_device_to_user(text)
FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_credit_balance_for_user_device(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_profile_credit_floor(uuid, integer)
TO service_role;

GRANT EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.link_device_to_user(text)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_credit_balance_for_user_device(uuid, text)
TO service_role;
