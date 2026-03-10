-- Create enum for table status
CREATE TYPE table_status AS ENUM ('free', 'occupied', 'activated');
-- Create enum for session status
CREATE TYPE session_status AS ENUM ('open', 'closed');
-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');

-- 1. Tables Table
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL UNIQUE,
  status table_status DEFAULT 'free',
  qr_token UUID UNIQUE DEFAULT gen_random_uuid(), -- The permanent token for the QR code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sessions Table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  session_token VARCHAR(255), -- The temporary secure token
  customer_name VARCHAR(100) NOT NULL,
  status session_status DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Menu Categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 4. Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- Array of objects: { item_id, quantity, price, notes }
  total_amount DECIMAL(10,2) NOT NULL,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INSERT DUMMY DATA FOR TESTING
-- Insert 3 Tables
INSERT INTO tables (table_number, status) VALUES 
(1, 'free'), (2, 'free'), (3, 'free');

-- Insert Menu Categories
INSERT INTO menu_categories (id, name, sort_order) VALUES 
('c1a8d56b-36b0-4f52-875f-25c2759e31d4', 'Coffee', 1),
('c2a8d56b-36b0-4f52-875f-25c2759e31d4', 'Smoothies', 2),
('c3a8d56b-36b0-4f52-875f-25c2759e31d4', 'Pastries', 3);

-- Insert Menu Items
INSERT INTO menu_items (category_id, name, description, price, image_url) VALUES
('c1a8d56b-36b0-4f52-875f-25c2759e31d4', 'Espresso', 'Strong and bold shot of coffee.', 3.50, 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04'),
('c1a8d56b-36b0-4f52-875f-25c2759e31d4', 'Latte', 'Espresso with steamed milk and a light layer of foam.', 4.50, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f'),
('c2a8d56b-36b0-4f52-875f-25c2759e31d4', 'Mango Smoothie', 'Fresh mango blended with honey and yogurt.', 6.00, 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4'),
('c3a8d56b-36b0-4f52-875f-25c2759e31d4', 'Croissant', 'Flaky, buttery French pastry.', 3.00, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a');
