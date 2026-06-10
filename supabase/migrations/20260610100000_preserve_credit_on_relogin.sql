-- Preserve visible credits during auth/profile relinking.
-- Login/logout/profile refresh must not be a credit-changing action.

CREATE OR REPLACE FUNCTION public.ensure_signup_bonus(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_credits integer;
  v_balance integer;
  v_adjustment integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT credits
  INTO v_stored_credits
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF v_stored_credits IS NULL THEN
    RETURN;
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

  IF v_stored_credits > COALESCE(v_balance, 0) THEN
    v_adjustment := v_stored_credits - COALESCE(v_balance, 0);

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
      'Kredi duzeltme - oturum yenileme'
    );
  END IF;

  PERFORM public.recalculate_profile_credits(p_profile_id);
END;
$$;

DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  FOR v_profile_id IN
    SELECT id
    FROM public.profiles
  LOOP
    PERFORM public.ensure_signup_bonus(v_profile_id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_signup_bonus(uuid)
TO service_role;
