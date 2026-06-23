-- Backfill first-credit rows for existing authenticated users and make sure
-- profile credits match the credit ledger.

WITH missing_auth_profiles AS (
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
  0,
  now(),
  now(),
  id
FROM missing_auth_profiles
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

WITH auth_profiles AS (
  SELECT DISTINCT p.id AS profile_id
  FROM auth.users u
  JOIN public.profiles p
    ON p.id = u.id OR p.user_id = u.id
),
missing_signup_bonus AS (
  SELECT ap.profile_id
  FROM auth_profiles ap
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions ct
    WHERE ct.user_id = ap.profile_id
      AND ct.type = 'signup_bonus'
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
FROM missing_signup_bonus;

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
