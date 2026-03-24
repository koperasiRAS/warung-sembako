-- =====================================================
-- POS Transaction Atomicity Function
-- Creates a complete transaction with stock updates and balance
-- =====================================================

CREATE OR REPLACE FUNCTION create_pos_transaction(
  p_cashier_id UUID,
  p_total NUMERIC(10, 2),
  p_payment_method TEXT,
  p_items JSONB
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_price NUMERIC(10, 2);
  v_today DATE := CURRENT_DATE;
  v_balance RECORD;
  v_yesterday DATE := v_today - 1;
  v_yesterday_balance RECORD;
BEGIN
  -- Validate payment method
  IF p_payment_method NOT IN ('cash', 'qris', 'transfer', 'hutang') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- Ensure today's balance exists
  SELECT * INTO v_balance
  FROM daily_balances
  WHERE date = v_today;

  IF NOT FOUND THEN
    -- Get yesterday's balance
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
    )
    RETURNING * INTO v_balance;
  END IF;

  -- Insert transaction
  INSERT INTO transactions (total, payment_method, cashier_id, status)
  VALUES (p_total, p_payment_method, p_cashier_id, 'completed')
  RETURNING id INTO v_transaction_id;

  -- Insert transaction items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    v_price := (v_item->>'price')::NUMERIC(10, 2);

    -- Insert transaction item
    INSERT INTO transaction_items (transaction_id, product_id, qty, price)
    VALUES (v_transaction_id, v_product_id, v_qty, v_price);

    -- Check stock availability before deducting
    DECLARE
      v_current_stock INTEGER;
    BEGIN
      SELECT stock INTO v_current_stock FROM products WHERE id = v_product_id;
      IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Product with ID % not found', v_product_id;
      END IF;
      IF v_current_stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %: available=%, requested=%', v_product_id, v_current_stock, v_qty;
      END IF;

      -- Update product stock
      UPDATE products
      SET stock = stock - v_qty,
          updated_at = NOW()
      WHERE id = v_product_id;
    END;
  END LOOP;

  -- Update daily balance
  IF p_payment_method = 'cash' THEN
    UPDATE daily_balances
    SET cash_balance = cash_balance + p_total,
        updated_at = NOW()
    WHERE date = v_today;
  ELSIF p_payment_method IN ('qris', 'transfer') THEN
    UPDATE daily_balances
    SET bank_balance = bank_balance + p_total,
        updated_at = NOW()
    WHERE date = v_today;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;
