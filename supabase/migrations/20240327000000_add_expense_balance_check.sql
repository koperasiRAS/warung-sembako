-- Migration: Add balance check to reverse_balance_after_expense
-- Prevents overspending: balance cannot go negative on expenses
-- Run this in Supabase SQL Editor

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
  v_current_balance NUMERIC(10, 2);
BEGIN
  -- Check if today's balance exists
  SELECT * INTO v_balance
  FROM daily_balances
  WHERE date = v_today;

  IF NOT FOUND THEN
    SELECT cash_balance, bank_balance INTO v_yesterday_balance
    FROM daily_balances
    WHERE date = v_yesterday;

    INSERT INTO daily_balances (date, cash_balance, bank_balance, opening_cash)
    VALUES (
      v_today,
      COALESCE(v_yesterday_balance.cash_balance, 0),
      COALESCE(v_yesterday_balance.bank_balance, 0),
      COALESCE(v_yesterday_balance.cash_balance, 0)
    )
    RETURNING * INTO v_balance;
  END IF;

  -- Validate payment method and get current balance
  IF p_payment_method = 'cash' THEN
    v_current_balance := v_balance.cash_balance;
  ELSIF p_payment_method = 'bank' THEN
    v_current_balance := v_balance.bank_balance;
  ELSE
    RAISE EXCEPTION 'Metode pembayaran tidak valid: %', p_payment_method;
  END IF;

  -- BALANCE CHECK: reject if insufficient
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE:%sSaldo %s tidak mencukupi. Saldo tersedia: Rp %s, Pengeluaran: Rp %s',
      E'\n',
      CASE p_payment_method WHEN 'cash' THEN 'tunai' ELSE 'bank' END,
      ROUND(v_current_balance)::TEXT,
      ROUND(p_amount)::TEXT;
  END IF;

  -- Update the balance
  IF p_payment_method = 'cash' THEN
    UPDATE daily_balances
    SET cash_balance = cash_balance - p_amount, updated_at = NOW()
    WHERE date = v_today;
  ELSIF p_payment_method = 'bank' THEN
    UPDATE daily_balances
    SET bank_balance = bank_balance - p_amount, updated_at = NOW()
    WHERE date = v_today;
  END IF;
END;
$$ LANGUAGE plpgsql;
