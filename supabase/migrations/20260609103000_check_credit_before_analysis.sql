-- Check credit before analysis, debit only after a successful analysis result.

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
  v_device_profile_id uuid;
  v_device_profile_user_id uuid;
  v_current_credits integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN 0;
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
  v_current_credits := public.recalculate_profile_credits(v_user_profile_id);

  RETURN COALESCE(v_current_credits, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_credit_balance_for_user_device(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_credit_balance_for_user_device(uuid, text)
TO service_role;
