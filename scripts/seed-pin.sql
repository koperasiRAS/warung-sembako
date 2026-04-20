-- Seed script: Set default PIN 123456 for all cashiers with NULL pin_hash
-- PIN: 123456
-- Hash: bcrypt via pgcrypto (gen_salt('bf') = Blowfish, cost factor 10)
-- Usage: Run in Supabase SQL Editor, or: supabase db execute -f scripts/seed-pin.sql

-- Step 1: Show affected rows (dry run)
SELECT id, email, full_name, role, pin_hash
FROM profiles
WHERE role = 'cashier' AND pin_hash IS NULL;

-- Step 2: Apply hash to all NULL pin_hash casiers
-- PIN "123456" hashed with bcrypt (bf), cost factor 10
UPDATE profiles
SET pin_hash = crypt('123456', gen_salt('bf'))
WHERE role = 'cashier'
  AND pin_hash IS NULL;

-- Step 3: Verify
-- SELECT id, email, full_name, role,
--        crypt('123456', pin_hash) = pin_hash AS pin_match
-- FROM profiles
-- WHERE role = 'cashier';
