-- V3 Features Migration
-- Tables for: Shifts, Debts, Debt Payments

-- 1. Create Shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cashier_id UUID NOT NULL REFERENCES auth.users(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    expected_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
    actual_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
    variance DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Debts table
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES public.transactions(id),
    customer_name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    remaining_amount DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Debt Payments table
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add 'hutang' to transaction payment_method
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check CHECK (payment_method IN ('cash', 'qris', 'transfer', 'hutang'));

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- Shifts Policies
CREATE POLICY "Enable read access for all users on shifts" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on shifts" ON public.shifts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for users based on id or role" ON public.shifts FOR UPDATE USING (auth.uid() = cashier_id OR (SELECT role FROM profiles WHERE profiles.id = auth.uid()) = 'owner');

-- Debts Policies
CREATE POLICY "Enable read access for all users on debts" ON public.debts FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on debts" ON public.debts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users on debts" ON public.debts FOR UPDATE USING (auth.role() = 'authenticated');

-- Debt Payments Policies
CREATE POLICY "Enable read access for all users on debt_payments" ON public.debt_payments FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on debt_payments" ON public.debt_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Set up realtime
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.debts;
alter publication supabase_realtime add table public.debt_payments;
