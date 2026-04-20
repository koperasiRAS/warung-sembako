-- Warung Sembako POS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- email: deprecated — used only by auth.users; kept for reference, no longer used in app UI
  email TEXT NOT NULL,
  full_name TEXT,
  -- pin_hash: primary login method for cashiers (set via /api/pin)
  pin_hash VARCHAR(255),
  role TEXT NOT NULL CHECK (role IN ('owner', 'cashier')) DEFAULT 'cashier',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  barcode TEXT UNIQUE,
  sku TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for barcode lookup (performance)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL CHECK (status IN ('completed', 'voided')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for transaction date lookup
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Transaction Items table
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for transaction items lookup
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Balances table
CREATE TABLE IF NOT EXISTS daily_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  cash_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bank_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  opening_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (RLS) - Enable on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (will be skipped if already exist - no error)
-- Run policies separately if needed - see policies.sql

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'cashier')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update product timestamp
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

-- =====================================================
-- Stock Management Functions
-- =====================================================

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
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Balance Management Functions
-- =====================================================

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

-- =====================================================
-- Transaction Void Functions
-- =====================================================

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
    WHERE date = CURRENT_DATE;
  ELSIF v_transaction.payment_method IN ('qris', 'transfer') THEN
    UPDATE daily_balances
    SET bank_balance = bank_balance - v_transaction.total,
        updated_at = NOW()
    WHERE date = CURRENT_DATE;
  END IF;

  UPDATE transactions
  SET status = 'voided'
  WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;