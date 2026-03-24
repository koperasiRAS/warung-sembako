-- =====================================================
-- RLS POLICIES - Warung Sembako POS
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor
-- This updates Row Level Security policies for all tables
-- NOTE: This migration DROPs existing policies first, then creates new ones
-- =====================================================

-- =====================================================
-- 0. DROP EXISTING POLICIES (from old migrations)
-- =====================================================

-- Drop shifts policies from previous migration
DROP POLICY IF EXISTS "Enable read access for all users on shifts" ON shifts;
DROP POLICY IF EXISTS "Enable insert for authenticated users on shifts" ON shifts;
DROP POLICY IF EXISTS "Enable update for users based on id or role" ON shifts;

-- Drop debts policies from previous migration
DROP POLICY IF EXISTS "Enable read access for all users on debts" ON debts;
DROP POLICY IF EXISTS "Enable insert for authenticated users on debts" ON debts;
DROP POLICY IF EXISTS "Enable update for authenticated users on debts" ON debts;

-- Drop debt_payments policies from previous migration
DROP POLICY IF EXISTS "Enable read access for all users on debt_payments" ON debt_payments;
DROP POLICY IF EXISTS "Enable insert for authenticated users on debt_payments" ON debt_payments;

-- Drop old custom policies (if any)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_owner" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_owner" ON profiles;

DROP POLICY IF EXISTS "categories_select_authenticated" ON categories;
DROP POLICY IF EXISTS "categories_insert_owner" ON categories;
DROP POLICY IF EXISTS "categories_update_owner" ON categories;
DROP POLICY IF EXISTS "categories_delete_owner" ON categories;

DROP POLICY IF EXISTS "products_select_authenticated" ON products;
DROP POLICY IF EXISTS "products_insert_owner" ON products;
DROP POLICY IF EXISTS "products_update_owner" ON products;
DROP POLICY IF EXISTS "products_delete_owner" ON products;

DROP POLICY IF EXISTS "transactions_select_authenticated" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_authenticated" ON transactions;
DROP POLICY IF EXISTS "transactions_update_owner" ON transactions;
DROP POLICY IF EXISTS "transactions_delete_owner" ON transactions;

DROP POLICY IF EXISTS "transaction_items_select_authenticated" ON transaction_items;
DROP POLICY IF EXISTS "transaction_items_insert_authenticated" ON transaction_items;
DROP POLICY IF EXISTS "transaction_items_update_owner" ON transaction_items;
DROP POLICY IF EXISTS "transaction_items_delete_owner" ON transaction_items;

DROP POLICY IF EXISTS "expenses_select_authenticated" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_owner" ON expenses;
DROP POLICY IF EXISTS "expenses_update_owner" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_owner" ON expenses;

DROP POLICY IF EXISTS "debts_select_authenticated" ON debts;
DROP POLICY IF EXISTS "debts_insert_authenticated" ON debts;
DROP POLICY IF EXISTS "debts_update_authenticated" ON debts;
DROP POLICY IF EXISTS "debts_delete_owner" ON debts;

DROP POLICY IF EXISTS "debt_payments_select_authenticated" ON debt_payments;
DROP POLICY IF EXISTS "debt_payments_insert_authenticated" ON debt_payments;
DROP POLICY IF EXISTS "debt_payments_update_owner" ON debt_payments;
DROP POLICY IF EXISTS "debt_payments_delete_owner" ON debt_payments;

DROP POLICY IF EXISTS "inventory_transactions_select_authenticated" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_insert_authenticated" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_update_owner" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_delete_owner" ON inventory_transactions;

DROP POLICY IF EXISTS "shifts_select_authenticated" ON shifts;
DROP POLICY IF EXISTS "shifts_select_all_authenticated" ON shifts;
DROP POLICY IF EXISTS "shifts_insert_authenticated" ON shifts;
DROP POLICY IF EXISTS "shifts_update_authenticated" ON shifts;

DROP POLICY IF EXISTS "daily_balances_select_authenticated" ON daily_balances;
DROP POLICY IF EXISTS "daily_balances_insert_owner" ON daily_balances;
DROP POLICY IF EXISTS "daily_balances_update_owner" ON daily_balances;

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all profiles (needed for cashier list)
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can only update their own profile
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Policy: Only owners can insert profiles (for creating cashiers)
CREATE POLICY "profiles_insert_owner"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete profiles
CREATE POLICY "profiles_delete_owner"
ON profiles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 2. CATEGORIES TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view categories
CREATE POLICY "categories_select_authenticated"
ON categories FOR SELECT
TO authenticated
USING (true);

-- Policy: Only owners can insert categories
CREATE POLICY "categories_insert_owner"
ON categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can update categories
CREATE POLICY "categories_update_owner"
ON categories FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete categories
CREATE POLICY "categories_delete_owner"
ON categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 3. PRODUCTS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view products
CREATE POLICY "products_select_authenticated"
ON products FOR SELECT
TO authenticated
USING (true);

-- Policy: Only owners can insert products
CREATE POLICY "products_insert_owner"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can update products
CREATE POLICY "products_update_owner"
ON products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete products
CREATE POLICY "products_delete_owner"
ON products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 4. TRANSACTIONS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view transactions
CREATE POLICY "transactions_select_authenticated"
ON transactions FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert transactions (cashiers make sales)
CREATE POLICY "transactions_insert_authenticated"
ON transactions FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

-- Policy: Only owners can update/void transactions
CREATE POLICY "transactions_update_owner"
ON transactions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete transactions
CREATE POLICY "transactions_delete_owner"
ON transactions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 5. TRANSACTION_ITEMS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view their own transaction items
CREATE POLICY "transaction_items_select_authenticated"
ON transaction_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
  )
);

-- Policy: Authenticated users can insert transaction items
-- (only if they have access to the parent transaction)
CREATE POLICY "transaction_items_insert_authenticated"
ON transaction_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id AND t.cashier_id = auth.uid()
  )
);

-- Policy: Only owners can update transaction items
CREATE POLICY "transaction_items_update_owner"
ON transaction_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete transaction items
CREATE POLICY "transaction_items_delete_owner"
ON transaction_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 6. EXPENSES TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view expenses
CREATE POLICY "expenses_select_authenticated"
ON expenses FOR SELECT
TO authenticated
USING (true);

-- Policy: Only owners can insert expenses
CREATE POLICY "expenses_insert_owner"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can update expenses
CREATE POLICY "expenses_update_owner"
ON expenses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete expenses
CREATE POLICY "expenses_delete_owner"
ON expenses FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 7. DEBTS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view debts
CREATE POLICY "debts_select_authenticated"
ON debts FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert debts (for creating new debts)
CREATE POLICY "debts_insert_authenticated"
ON debts FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update debts (for recording payments)
CREATE POLICY "debts_update_authenticated"
ON debts FOR UPDATE
TO authenticated
USING (true);

-- Policy: Only owners can delete debts
CREATE POLICY "debts_delete_owner"
ON debts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 8. DEBT_PAYMENTS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view debt payments
CREATE POLICY "debt_payments_select_authenticated"
ON debt_payments FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert debt payments
CREATE POLICY "debt_payments_insert_authenticated"
ON debt_payments FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Only owners can update debt payments
CREATE POLICY "debt_payments_update_owner"
ON debt_payments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete debt payments
CREATE POLICY "debt_payments_delete_owner"
ON debt_payments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 9. INVENTORY_TRANSACTIONS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view inventory transactions
CREATE POLICY "inventory_transactions_select_authenticated"
ON inventory_transactions FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert inventory transactions (for restocks)
CREATE POLICY "inventory_transactions_insert_authenticated"
ON inventory_transactions FOR INSERT
TO authenticated
WITH CHECK (processed_by = auth.uid());

-- Policy: Only owners can update inventory transactions
CREATE POLICY "inventory_transactions_update_owner"
ON inventory_transactions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can delete inventory transactions
CREATE POLICY "inventory_transactions_delete_owner"
ON inventory_transactions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 10. SHIFTS TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view their own shifts
CREATE POLICY "shifts_select_authenticated"
ON shifts FOR SELECT
TO authenticated
USING (cashier_id = auth.uid());

-- Policy: Authenticated users can view all shifts (for reports)
CREATE POLICY "shifts_select_all_authenticated"
ON shifts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Authenticated users can insert shifts (cashiers start shift)
CREATE POLICY "shifts_insert_authenticated"
ON shifts FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

-- Policy: Authenticated users can update their own shifts
CREATE POLICY "shifts_update_authenticated"
ON shifts FOR UPDATE
TO authenticated
USING (
  cashier_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- 11. DAILY_BALANCES TABLE
-- =====================================================

-- Enable RLS
ALTER TABLE daily_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view daily balances
CREATE POLICY "daily_balances_select_authenticated"
ON daily_balances FOR SELECT
TO authenticated
USING (true);

-- Policy: Only owners can insert daily balances
CREATE POLICY "daily_balances_insert_owner"
ON daily_balances FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Policy: Only owners can update daily balances
CREATE POLICY "daily_balances_update_owner"
ON daily_balances FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
