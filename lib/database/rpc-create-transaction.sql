-- =====================================================
-- POS Transaction Atomicity Function
-- Creates a complete transaction with stock updates and balance
-- Fixes: race condition (atomic UPDATE), partial rollback (subtransaction),
-- server-side price validation
-- =====================================================

CREATE OR REPLACE FUNCTION create_pos_transaction(
  p_cashier_id UUID,
  p_total NUMERIC(10, 2),
  p_payment_method TEXT,
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL  -- for hutang debt recording
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_client_price NUMERIC(10, 2);
  v_db_price NUMERIC(10, 2);
  v_db_stock INTEGER;
  v_updated_rows INTEGER;
  v_today DATE := CURRENT_DATE;
  v_balance RECORD;
  v_yesterday DATE := v_today - 1;
  v_yesterday_balance RECORD;
  v_temp_id UUID;  -- used in subtransaction cleanup
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

  -- Insert transaction record first
  INSERT INTO transactions (total, payment_method, cashier_id, status)
  VALUES (p_total, p_payment_method, p_cashier_id, 'completed')
  RETURNING id INTO v_transaction_id;

  -- Process items inside a subtransaction
  -- If ANY item fails, the entire transaction (including transaction record) is rolled back
  BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_qty := (v_item->>'qty')::INTEGER;
      v_client_price := (v_item->>'price')::NUMERIC(10, 2);

      -- Server-side price validation: fetch actual price from DB
      SELECT price, stock INTO v_db_price, v_db_stock
      FROM products
      WHERE id = v_product_id;

      IF v_db_price IS NULL THEN
        RAISE EXCEPTION 'Produk tidak ditemukan: %', v_product_id;
      END IF;

      -- Price tolerance: allow 1% deviation to handle rounding
      IF ABS(v_client_price - v_db_price) > v_db_price * 0.01 THEN
        RAISE EXCEPTION 'Harga produk % tidak valid.前台: % DB: %', v_product_id, v_client_price, v_db_price;
      END IF;

      -- Atomic stock decrement: only succeeds if stock >= qty
      -- This prevents race condition (TOCTOU) that existed in the old SELECT-then-UPDATE pattern
      UPDATE products
      SET stock = stock - v_qty,
          updated_at = NOW()
      WHERE id = v_product_id
        AND stock >= v_qty;

      GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

      IF v_updated_rows = 0 THEN
        RAISE EXCEPTION 'Stok tidak mencukupi untuk produk %. Stok saat ini: %', v_product_id, COALESCE(v_db_stock, 0);
      END IF;

      -- Insert transaction item with DB-verified price
      INSERT INTO transaction_items (transaction_id, product_id, qty, price)
      VALUES (v_transaction_id, v_product_id, v_qty, v_db_price);
    END LOOP;

    -- Record debt for hutang payment (atomic within same transaction)
    IF p_payment_method = 'hutang' AND p_customer_name IS NOT NULL AND p_customer_name != '' THEN
      INSERT INTO debts (transaction_id, customer_name, amount, remaining_amount, status)
      VALUES (v_transaction_id, p_customer_name, p_total, p_total, 'unpaid');
    END IF;

  EXCEPTION
    WHEN others THEN
      -- Rollback the subtransaction (transaction record is also rolled back by the RAISE)
      RAISE;
  END;

  -- Update daily balance (outside subtransaction, after items succeed)
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
