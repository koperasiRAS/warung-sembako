-- =====================================================
-- Phase 3: Performance - Database Indexes
-- Created: 2026-03-24
-- Purpose: Add indexes for frequently queried columns
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Transactions: filter by date range, status, cashier
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);

-- Products: filter by category, barcode lookup
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE stock < 10;

-- Inventory transactions: filter by product, date
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_transactions(type);

-- Debts: filter by status, customer name search
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customer_name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_debts_created ON debts(created_at DESC);

-- Debt payments: lookup by debt_id
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);

-- Expenses: filter by date, payment method
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);

-- Shifts: filter by cashier, status
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_created ON shifts(start_time DESC);

-- Profiles: lookup by role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
