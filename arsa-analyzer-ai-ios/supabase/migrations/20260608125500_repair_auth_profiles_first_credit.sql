-- Repair auth users whose profile or first-credit transaction was not created.
-- This grants the first free credit only to accounts that have no credit history yet.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_transactions boolean;
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
      updated_at = now();

  SELECT EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE user_id = NEW.id
  )
  INTO v_has_transactions;

  IF NOT v_has_transactions THEN
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
    );

    UPDATE public.profiles
    SET credits = GREATEST(credits, 1),
        updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

WITH missing_profiles AS (
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Kullanıcı') AS display_name,
    u.raw_user_meta_data ->> 'avatar_url' AS avatar_url
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = u.id OR p.user_id = u.id
  )
)
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
SELECT
  id,
  email,
  display_name,
  avatar_url,
  1,
  now(),
  now(),
  id
FROM missing_profiles
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

WITH user_profiles AS (
  SELECT u.id AS auth_user_id, p.id AS profile_id
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id OR p.user_id = u.id
),
profiles_without_history AS (
  SELECT DISTINCT profile_id
  FROM user_profiles up
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions ct
    WHERE ct.user_id = up.profile_id
  )
)
INSERT INTO public.credit_transactions (
  user_id,
  amount,
  type,
  description
)
SELECT
  profile_id,
  1,
  'signup_bonus',
  'Hoş geldin bonusu - 1 ücretsiz sorgu'
FROM profiles_without_history;

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

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
