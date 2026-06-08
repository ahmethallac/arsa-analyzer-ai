-- Do not restore a spent free credit when the app refreshes the signed-in profile.
-- Existing balances are reconciled from the transaction ledger once after this fix.

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

  SELECT id
  INTO v_user_profile_id
  FROM public.profiles
  WHERE user_id = v_uid OR id = v_uid
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_user_profile_id IS NOT NULL THEN
    IF v_device_profile_id IS NOT NULL AND v_device_profile_id <> v_user_profile_id THEN
      UPDATE public.profiles
      SET credits = GREATEST(credits, COALESCE(v_device_credits, 0)),
          user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;

      UPDATE public.credit_transactions
      SET user_id = v_user_profile_id
      WHERE user_id = v_device_profile_id
        AND type <> 'signup_bonus';

      DELETE FROM public.profiles
      WHERE id = v_device_profile_id;
    ELSE
      UPDATE public.profiles
      SET user_id = v_uid,
          device_id = p_device_id,
          updated_at = now()
      WHERE id = v_user_profile_id;
    END IF;

    RETURN json_build_object('success', true, 'profile_id', v_user_profile_id);
  END IF;

  IF v_device_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id = v_uid,
        updated_at = now()
    WHERE id = v_device_profile_id;

    RETURN json_build_object('success', true, 'profile_id', v_device_profile_id);
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

  RETURN json_build_object('success', true, 'profile_id', v_user_profile_id);
END;
$$;

WITH transaction_balances AS (
  SELECT user_id, GREATEST(COALESCE(SUM(amount), 0), 0)::integer AS balance
  FROM public.credit_transactions
  GROUP BY user_id
)
UPDATE public.profiles p
SET credits = transaction_balances.balance,
    updated_at = now()
FROM transaction_balances
WHERE p.id = transaction_balances.user_id;

GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;
