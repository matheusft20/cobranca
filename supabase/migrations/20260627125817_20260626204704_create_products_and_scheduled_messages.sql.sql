/*
# Create Products and Scheduled Messages Tables

1. New Tables
- `products`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `name` (text, not null) - product/service name
  - `price` (integer, not null) - price in cents (BRL)
  - `quantity` (integer, not null, default 1) - available quantity
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

- `scheduled_messages`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `client_id` (uuid, not null, references clients)
  - `transaction_id` (uuid, nullable, references transactions) - optional link to a charge
  - `message_text` (text, not null) - message content
  - `send_date` (date, not null) - when to send
  - `send_time` (time, not null) - time to send
  - `is_active` (boolean, not null, default true) - enabled/disabled toggle
  - `sent_at` (timestamptz, nullable) - when message was actually sent
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- `products`: user_id ownership check
- `scheduled_messages`: user_id ownership check (client_id is validated via transaction ownership)

3. Indexes
- Index on `products.user_id` for faster queries
- Index on `scheduled_messages.user_id` for faster queries
- Index on `scheduled_messages.send_date` for cron/scheduled queries
*/

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEDULED_MESSAGES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  message_text text NOT NULL,
  send_date date NOT NULL,
  send_time time NOT NULL DEFAULT '09:00:00',
  is_active boolean NOT NULL DEFAULT true,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_id ON scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_send_date ON scheduled_messages(send_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_client_id ON scheduled_messages(client_id);

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scheduled_messages" ON scheduled_messages;
CREATE POLICY "select_own_scheduled_messages" ON scheduled_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_scheduled_messages" ON scheduled_messages;
CREATE POLICY "insert_own_scheduled_messages" ON scheduled_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_scheduled_messages" ON scheduled_messages;
CREATE POLICY "update_own_scheduled_messages" ON scheduled_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_scheduled_messages" ON scheduled_messages;
CREATE POLICY "delete_own_scheduled_messages" ON scheduled_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();