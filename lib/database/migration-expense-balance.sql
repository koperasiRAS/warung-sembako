-- Migration: Fix expense balance and ensure daily balance exists
-- Run this in Supabase SQL Editor

-- Update reverse_balance_after_expense function to create daily balance if not exists
CREATE OR REPLACE FUNCTION reverse_balance_after_expense(
  p_payment_method TEXT,
  p_amount NUMERIC(10, 2)
)
RETURNS VOID AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_balance RECORD;
  v_yesterday DATE := v_today - 1;
  v_yesterday_balance RECORD;
BEGIN
  -- Check if today's balance exists
  SELECT * INTO v_balance
  FROM daily_balances
  WHERE date = v_today;

  IF NOT FOUND THEN
    -- Get yesterday's balance for opening cash
    SELECT cash_balance, bank_balance INTO v_yesterday_balance
    FROM daily_balances
    WHERE date = v_yesterday;

    -- Create today's balance
    INSERT INTO daily_balances (date, cash_balance, bank_balance, opening_cash)
    VALUES (
      v_today,
      COALESCE(v_yesterday_balance.cash_balance, 0),
      COALESCE(v_yesterday_balance.bank_balance, 0),
      COALESCE(v_yesterday_balance.cash_balance, 0)
    );
  END IF;

  -- Update the balance
  IF p_payment_method = 'cash' THEN
    UPDATE daily_balances
    SET cash_balance = cash_balance - p_amount,
        updated_at = NOW()
    WHERE date = v_today;
  ELSIF p_payment_method = 'bank' THEN
    UPDATE daily_balances
    SET bank_balance = bank_balance - p_amount,
        updated_at = NOW()
    WHERE date = v_today;
  END IF;
END;
$$ LANGUAGE plpgsql;
