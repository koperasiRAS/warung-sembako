-- Add opening_cash and total_profit columns to shifts table
-- opening_cash: nominal laci saat buka shift
-- total_profit: profit bersih shift (laba kotor)

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_cash DECIMAL(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_profit DECIMAL(12,2) DEFAULT 0 NOT NULL;
