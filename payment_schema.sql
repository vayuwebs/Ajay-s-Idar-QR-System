-- Payment Integration Schema Updates

-- 1. Create Settings table (singleton)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    upi_id VARCHAR(255),
    payee_name VARCHAR(255),
    payment_timing VARCHAR(50) DEFAULT 'dont_take_payment', -- 'while_ordering', 'after_order', 'dont_take_payment'
    charge_type VARCHAR(50) DEFAULT 'fixed', -- 'fixed', 'percentage'
    charge_amount DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings row if it doesn't exist
INSERT INTO settings (id, payment_timing, charge_type, charge_amount)
VALUES (1, 'dont_take_payment', 'fixed', 0.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Add payment status to orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;
