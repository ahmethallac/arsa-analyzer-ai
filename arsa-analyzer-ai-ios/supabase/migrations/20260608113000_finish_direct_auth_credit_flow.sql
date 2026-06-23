-- Final direct auth/profile flow used when the app reads the signed-in user's own profile directly.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    credits,
    created_at,
    updated_at,
    user_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'Kullanıcı'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    1,
    now(),
    now(),
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      email = EXCLUDED.email,
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
      credits = GREATEST(public.profiles.credits, 1),
      updated_at = now();

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    description
  )
  VALUES (
    NEW.id,
    1,
    'signup_bonus',
    'Hoş geldin bonusu - 1 ücretsiz sorgu'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.credit_transactions TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR id = auth.uid());

DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id
    FROM public.profiles
    WHERE user_id = auth.uid() OR id = auth.uid()
  )
);

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.link_device_to_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, text) TO authenticated, service_role;
