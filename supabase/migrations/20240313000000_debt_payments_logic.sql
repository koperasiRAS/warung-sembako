-- Migration: Update Debt Payments Logic to support payment methods and update warung balances
-- Date: 2024-03-13

-- 1. Add payment_method to debt_payments table
ALTER TABLE public.debt_payments 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'transfer', 'qris'));

-- 2. Create RPC function to handle debt payments securely
CREATE OR REPLACE FUNCTION pay_debt(
    p_debt_id UUID,
    p_amount DECIMAL(12,2),
    p_payment_method TEXT,
    p_note TEXT
)
RETURNS VOID AS $$
DECLARE
    v_remaining DECIMAL(12,2);
    v_new_status TEXT;
BEGIN
    -- 1. Insert into debt_payments
    INSERT INTO public.debt_payments (debt_id, amount, payment_method, note)
    VALUES (p_debt_id, p_amount, p_payment_method, p_note);

    -- 2. Update debt remaining_amount and status
    SELECT remaining_amount - p_amount INTO v_remaining
    FROM public.debts WHERE id = p_debt_id;

    IF v_remaining <= 0 THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partial';
    END IF;

    UPDATE public.debts
    SET remaining_amount = v_remaining,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_debt_id;

    -- 3. Update Daily Balances
    PERFORM update_balance_after_transaction(
        CASE WHEN p_payment_method IN ('transfer', 'qris', 'bank') THEN 'transfer' ELSE 'cash' END,
        p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
