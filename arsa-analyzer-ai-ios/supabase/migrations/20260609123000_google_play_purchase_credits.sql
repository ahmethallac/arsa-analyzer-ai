CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_purchase_token_unique
ON public.credit_transactions (purchase_token)
WHERE purchase_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_google_play_purchase_credits(
  p_user_id uuid,
  p_device_id text,
  p_product_id text,
  p_purchase_token text,
  p_credits integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_existing_transaction_id uuid;
  v_total_credits integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_device_id IS NULL OR NOT p_device_id ~ '^device_[a-zA-Z0-9_]{5,90}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_device_id');
  END IF;

  IF p_product_id IS NULL OR p_purchase_token IS NULL OR p_credits IS NULL OR p_credits <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_purchase');
  END IF;

  SELECT id
  INTO v_existing_transaction_id
  FROM public.credit_transactions
  WHERE purchase_token = p_purchase_token
  LIMIT 1;

  IF v_existing_transaction_id IS NOT NULL THEN
    SELECT credits
    INTO v_total_credits
    FROM public.profiles
    WHERE user_id = p_user_id OR id = p_user_id
    LIMIT 1;

    RETURN json_build_object(
      'success', true,
      'already_applied', true,
      'total_credits', COALESCE(v_total_credits, 0)
    );
  END IF;

  SELECT id
  INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id OR id = p_user_id OR device_id = p_device_id
  ORDER BY CASE WHEN user_id = p_user_id OR id = p_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (
      id,
      user_id,
      device_id,
      credits,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      p_user_id,
      p_device_id,
      0,
      now(),
      now()
    )
    RETURNING id INTO v_profile_id;
  ELSE
    UPDATE public.profiles
    SET user_id = COALESCE(user_id, p_user_id),
        device_id = COALESCE(device_id, p_device_id),
        updated_at = now()
    WHERE id = v_profile_id;
  END IF;

  UPDATE public.profiles
  SET credits = credits + p_credits,
      updated_at = now()
  WHERE id = v_profile_id
  RETURNING credits INTO v_total_credits;

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    description,
    purchase_token
  )
  VALUES (
    v_profile_id,
    p_credits,
    'purchase',
    'Google Play kredi paketi: ' || p_product_id,
    p_purchase_token
  );

  RETURN json_build_object(
    'success', true,
    'credits', p_credits,
    'total_credits', v_total_credits
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', true, 'already_applied', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_google_play_purchase_credits(uuid, text, text, text, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_google_play_purchase_credits(uuid, text, text, text, integer)
TO service_role;
