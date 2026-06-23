-- Guarantee that a newly authenticated user receives exactly one first free credit
-- when their device is linked. Spent credits are not restored.

CREATE OR REPLACE FUNCTION public.link_device_to_user(p_device_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_device_profile_id uuid;
  v_device_credits integer;
  v_user_profile_id uuid;
  v_user_credits integer;
  v_has_transactions boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_device_id');
  END IF;

  SELECT id, credits
  INTO v_device_profile_id, v_device_credits
  FROM public.profiles
  WHERE device_id = p_device_id
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT id, credits
  INTO v_user_profile_id, v_user_credits
  FROM public.profiles
  WHERE user_id = v_uid OR id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_user_profile_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.credit_transactions
      WHERE user_id = v_user_profile_id
    )
    INTO v_has_transactions;

    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      UPDATE public.credit_transactions
      SET user_id = v_user_profile_id
      WHERE user_id = v_device_profile_id
        AND type <> 'signup_bonus';

      UPDATE public.profiles
      SET credits = GREATEST(COALESCE(v_user_credits, 0), COALESCE(v_device_credits, 0)),
          user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;

      DELETE FROM public.profiles
      WHERE id = v_device_profile_id;
    ELSE
      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    END IF;

    IF NOT v_has_transactions THEN
      UPDATE public.profiles
      SET credits = GREATEST(credits, 1),
          updated_at = now()
      WHERE id = v_user_profile_id;

      INSERT INTO public.credit_transactions (
        user_id,
        type,
        amount,
        description
      )
      VALUES (
        v_user_profile_id,
        'signup_bonus',
        1,
        'Hoş geldin bonusu - 1 ücretsiz sorgu'
      );
    END IF;

    SELECT credits
    INTO v_user_credits
    FROM public.profiles
    WHERE id = v_user_profile_id;

    RETURN json_build_object(
      'success', true,
      'profile_id', v_user_profile_id,
      'device_id', p_device_id,
      'credits', COALESCE(v_user_credits, 0)
    );
  END IF;

  IF v_device_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id = v_uid,
        device_id = p_device_id,
        updated_at = now()
    WHERE id = v_device_profile_id;

    SELECT EXISTS (
      SELECT 1
      FROM public.credit_transactions
      WHERE user_id = v_device_profile_id
    )
    INTO v_has_transactions;

    IF NOT v_has_transactions THEN
      UPDATE public.profiles
      SET credits = GREATEST(credits, 1),
          updated_at = now()
      WHERE id = v_device_profile_id;

      INSERT INTO public.credit_transactions (
        user_id,
        type,
        amount,
        description
      )
      VALUES (
        v_device_profile_id,
        'signup_bonus',
        1,
        'Hoş geldin bonusu - 1 ücretsiz sorgu'
      );
    END IF;

    SELECT credits
    INTO v_device_credits
    FROM public.profiles
    WHERE id = v_device_profile_id;

    RETURN json_build_object(
      'success', true,
      'profile_id', v_device_profile_id,
      'device_id', p_device_id,
      'credits', COALESCE(v_device_credits, 0)
    );
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
    gen_random_uuid(),
    p_device_id,
    v_uid,
    1,
    now(),
    now()
  )
  RETURNING id INTO v_user_profile_id;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    description
  )
  VALUES (
    v_user_profile_id,
    'signup_bonus',
    1,
    'Hoş geldin bonusu - 1 ücretsiz sorgu'
  );

  RETURN json_build_object(
    'success', true,
    'profile_id', v_user_profile_id,
    'device_id', p_device_id,
    'credits', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;

WITH transaction_balances AS (
  SELECT user_id, GREATEST(COALESCE(SUM(amount), 0), 0)::integer AS balance
  FROM public.credit_transactions
  GROUP BY user_id
)
UPDATE public.profiles p
SET credits = transaction_balances.balance,
    updated_at = now()
FROM transaction_balances
WHERE p.id = transaction_balances.user_id
  AND p.credits IS DISTINCT FROM transaction_balances.balance;
