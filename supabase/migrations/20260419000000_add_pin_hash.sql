-- Migration: Add pin_hash column to profiles table
-- Date: 2026-04-19
-- Purpose: Enable PIN-based quick login for cashiers

-- Add pin_hash column (stores bcrypt/argon2 hash of 4-6 digit PIN)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

-- Index for PIN lookup (fast POS login)
CREATE INDEX IF NOT EXISTS idx_profiles_pin_hash ON profiles(pin_hash) WHERE pin_hash IS NOT NULL;
