-- Migration: Add verify_pin RPC functions using pgcrypto
-- Date: 2026-04-19
-- Purpose: Verify cashier PIN using PostgreSQL pgcrypto extension

-- Enable pgcrypto (usually enabled by default in Supabase, but explicit is safe)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- RPC: Verify PIN for a cashier
-- Uses pgcrypto's crypt() to safely compare plain PIN against stored hash
-- Returns the matched cashier profile row, or NULL if no match
CREATE OR REPLACE FUNCTION verify_pin(pin_input TEXT)
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM profiles p
  WHERE p.pin_hash IS NOT NULL
    AND crypt(pin_input, p.pin_hash) = p.pin_hash;
END;
$$;

-- RPC: Verify a plain text PIN against a stored hash
-- Used as fallback when verify_pin() returns unexpected structure
CREATE OR REPLACE FUNCTION verify_pin_plain(plain TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(plain, hash) = hash;
END;
$$;

-- Test: hash a PIN and store it
-- SELECT crypt('123456', gen_salt('bf'));
