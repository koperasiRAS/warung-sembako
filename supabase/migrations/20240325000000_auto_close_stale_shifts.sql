-- Auto-close stale shifts when a cashier tries to open a new shift
-- If a shift was left open from a previous day, close it automatically
-- before creating/returning the new day's shift

CREATE OR REPLACE FUNCTION ensure_open_shift(p_cashier_id UUID)
RETURNS SETOF shifts
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  open_shift shifts%ROWTYPE;
  jakarta_date DATE;
BEGIN
  -- Get current date in Jakarta timezone
  jakarta_date := DATE(NOW() AT TIME ZONE 'Asia/Jakarta');

  -- AUTO-CLOSE stale shifts from previous days first
  UPDATE shifts
  SET
    status = 'closed',
    end_time = NOW(),
    expected_cash = COALESCE((
      SELECT SUM(total)
      FROM transactions
      WHERE cashier_id = p_cashier_id
        AND status = 'completed'
        AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < jakarta_date
    ), 0),
    actual_cash = 0,
    variance = 0
  WHERE cashier_id = p_cashier_id
    AND status = 'open'
    AND DATE(start_time AT TIME ZONE 'Asia/Jakarta') < jakarta_date;

  -- Check if an open shift already exists for today
  SELECT * INTO open_shift
  FROM shifts
  WHERE cashier_id = p_cashier_id
    AND status = 'open'
    AND DATE(start_time AT TIME ZONE 'Asia/Jakarta') = jakarta_date;

  IF FOUND THEN
    RETURN NEXT open_shift;
  ELSE
    INSERT INTO shifts (cashier_id, status, start_time)
    VALUES (p_cashier_id, 'open', NOW())
    RETURNING * INTO open_shift;
    RETURN NEXT open_shift;
  END IF;
END;
$$;

-- Unique partial index already exists from previous migration:
-- CREATE UNIQUE INDEX idx_shifts_one_open_per_cashier ON shifts(cashier_id) WHERE status = 'open';
-- This ensures only one open shift per cashier at any given time.
