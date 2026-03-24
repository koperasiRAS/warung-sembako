-- =====================================================
-- Phase 4: Features - Stock Alerts
-- Created: 2026-03-24
-- Purpose: Add per-product low stock threshold column
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Add low_stock_threshold column with default 10
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10;

-- Create RPC function for getting low stock products (compares stock to threshold)
CREATE OR REPLACE FUNCTION get_low_stock_products(limit_count INTEGER DEFAULT 10)
RETURNS SETOF products
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM products
  WHERE stock < COALESCE(low_stock_threshold, 10)
  ORDER BY stock ASC
  LIMIT limit_count;
$$;

-- Optional: Create index on the threshold column for filtering
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(low_stock_threshold) WHERE stock < low_stock_threshold;
