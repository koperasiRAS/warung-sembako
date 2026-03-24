-- =====================================================
-- Fix: Shift open/close mechanism
-- Created: 2026-03-24
-- Purpose: Make shift state DB-backed (idempotent open, UPDATE on close)
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- RPC: ensure an open shift exists for a cashier (idempotent — safe to call on every POS load)
-- Returns the existing open shift row, or creates a new one if none exists
CREATE OR REPLACE FUNCTION ensure_open_shift(p_cashier_id UUID)
RETURNS SETOF shifts
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  open_shift shifts%ROWTYPE;
BEGIN
  -- Check if an open shift already exists for this cashier
  SELECT * INTO open_shift
  FROM shifts
  WHERE cashier_id = p_cashier_id AND status = 'open';

  IF FOUND THEN
    -- Return existing open shift (no duplicate)
    RETURN NEXT open_shift;
  ELSE
    -- Create new open shift
    INSERT INTO shifts (cashier_id, status, start_time)
    VALUES (p_cashier_id, 'open', NOW())
    RETURNING * INTO open_shift;
    RETURN NEXT open_shift;
  END IF;
END;
$$;

-- Ensure partial unique index: only one open shift per cashier at a time
-- (prevents race condition creating duplicates if two requests fire simultaneously)
DROP INDEX IF EXISTS idx_shifts_one_open_per_cashier;
CREATE UNIQUE INDEX idx_shifts_one_open_per_cashier
  ON shifts(cashier_id)
  WHERE status = 'open';
