-- Warung Sembako POS - Functions & Triggers
-- Run this after tables are created

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamp updates
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_daily_balances_updated_at ON daily_balances;
CREATE TRIGGER update_daily_balances_updated_at
  BEFORE UPDATE ON daily_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Stock Management Functions
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  SELECT stock INTO v_current_stock FROM products WHERE id = p_product_id;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  UPDATE products
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = stock + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Balance Management Functions
CREATE OR REPLACE FUNCTION update_balance_after_transaction(
  p_payment_method TEXT,
  p_amount NUMERIC(10, 2)
)
RETURNS VOID AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_balance RECORD;
BEGIN
  SELECT * INTO v_balance
  FROM daily_balances
  WHERE date = v_today;

  IF NOT FOUND THEN
    DECLARE
      v_yesterday DATE := v_today - 1;
      v_yesterday_balance RECORD;
    BEGIN
      SELECT cash_balance, bank_balance INTO v_yesterday_balance
      FROM daily_balances
      WHERE date = v_yesterday;

      INSERT INTO daily_balances (date, cash_balance, bank_balance, opening_cash)
      VALUES (
        v_today,
        COALESCE(v_yesterday_balance.cash_balance, 0),
        COALESCE(v_yesterday_balance.bank_balance, 0),
        COALESCE(v_yesterday_balance.cash_balance, 0)
      );
    END;
  END IF;

  IF p_payment_method = 'cash' THEN
    UPDATE daily_balances
    SET cash_balance = cash_balance + p_amount,
        updated_at = NOW()
    WHERE date = v_today;
  ELSIF p_payment_method IN ('qris', 'transfer') THEN
    UPDATE daily_balances
    SET bank_balance = bank_balance + p_amount,
        updated_at = NOW()
    WHERE date = v_today;
  END IF;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION initialize_daily_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_yesterday DATE := CURRENT_DATE - 1;
  v_yesterday_balance RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM daily_balances WHERE date = CURRENT_DATE) THEN
    RETURN NEW;
  END IF;

  SELECT cash_balance, bank_balance INTO v_yesterday_balance
  FROM daily_balances
  WHERE date = v_yesterday;

  INSERT INTO daily_balances (date, cash_balance, bank_balance, opening_cash)
  VALUES (
    CURRENT_DATE,
    COALESCE(v_yesterday_balance.cash_balance, 0),
    COALESCE(v_yesterday_balance.bank_balance, 0),
    COALESCE(v_yesterday_balance.cash_balance, 0)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_daily_balance ON transactions;
CREATE TRIGGER ensure_daily_balance
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION initialize_daily_balance();

-- Void Transaction Function
CREATE OR REPLACE FUNCTION void_transaction(p_transaction_id UUID)
RETURNS VOID AS $$
DECLARE
  v_transaction RECORD;
  v_items RECORD;
BEGIN
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  IF v_transaction.status = 'voided' THEN
    RAISE EXCEPTION 'Transaction already voided';
  END IF;

  FOR v_items IN
    SELECT product_id, qty
    FROM transaction_items
    WHERE transaction_id = p_transaction_id
  LOOP
    PERFORM increment_stock(v_items.product_id, v_items.qty);
  END LOOP;

  IF v_transaction.payment_method = 'cash' THEN
    UPDATE daily_balances
    SET cash_balance = cash_balance - v_transaction.total,
        updated_at = NOW()
    WHERE date = DATE(v_transaction.created_at);
  ELSIF v_transaction.payment_method IN ('qris', 'transfer') THEN
    UPDATE daily_balances
    SET bank_balance = bank_balance - v_transaction.total,
        updated_at = NOW()
    WHERE date = DATE(v_transaction.created_at);
  END IF;

  UPDATE transactions
  SET status = 'voided'
  WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;