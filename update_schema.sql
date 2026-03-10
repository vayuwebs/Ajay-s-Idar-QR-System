-- 1. Alter Tables Type (Add properties we need)
ALTER TYPE table_status RENAME VALUE 'activated' TO 'reserved'; -- Just in case you want to use it later, though we only need free/occupied

-- 2. Update Tables Table
ALTER TABLE tables ADD COLUMN IF NOT EXISTS current_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- 3. Update Sessions Table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;
-- Note: You said prompt without Fingerprint is gone, so if session_token was there, we can drop it.
ALTER TABLE sessions DROP COLUMN IF EXISTS session_token;

-- 4. Rebuild Orders Table (Relational approach)
-- First, drop the old items JSONB column from orders
ALTER TABLE orders DROP COLUMN IF EXISTS items;

-- 5. Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
