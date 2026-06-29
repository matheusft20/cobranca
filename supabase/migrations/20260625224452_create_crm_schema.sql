
/*
# CRM Transacional — Schema Inicial

## Visao Geral
Cria as tres tabelas centrais do MVP: profiles, clients e transactions.
Cada usuario autenticado tem seu proprio conjunto isolado de dados (multi-tenant).

## Tabelas

### 1. profiles
Armazena dados de configuracao do usuario alem do que o Supabase Auth ja guarda.
- `id` (uuid, PK) — mesmo ID do auth.users
- `company_name` (text) — nome da empresa exibido no app
- `pix_key` (text, nullable) — chave PIX padrao do recebedor
- `created_at`, `updated_at` — timestamps de controle

### 2. clients
Cadastro de clientes do usuario.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users) — dono do registro
- `name` (text) — nome completo ou razao social
- `whatsapp` (text, nullable) — numero com DDI, ex: 5511999999999
- `email` (text, nullable)
- `created_at`, `updated_at`

### 3. transactions
Registro de cada cobranca gerada.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users) — dono do registro
- `client_id` (uuid, FK → clients, nullable) — pode ser gerada sem cliente cadastrado
- `client_name` (text) — nome denormalizado para consultas rapidas
- `amount` (integer) — valor em centavos (ex: R$ 150,00 = 15000)
- `description` (text, nullable) — descricao do servico
- `status` (text) — 'pending' | 'paid' | 'cancelled' | 'overdue'
- `pix_key` (text, nullable) — chave PIX usada nesta transacao
- `pix_copy_paste` (text, nullable) — payload Pix copia-e-cola (mockado no MVP)
- `pix_qr_code` (text, nullable) — URL ou base64 do QR Code (mockado no MVP)
- `created_at`, `updated_at`

## Seguranca (RLS)
RLS habilitado em todas as tabelas. Cada usuario ve e gerencia apenas seus proprios dados.
Todas as politicas usam `auth.uid()` para garantir isolamento entre contas.

## Indexes
- `clients.user_id` — buscas frequentes de clientes por usuario
- `transactions.user_id` — buscas frequentes de transacoes por usuario
- `transactions.client_id` — historico de cobranças por cliente
- `transactions.status` — filtros de status no dashboard
- `transactions.created_at` — ordenacao cronologica
*/

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  pix_key    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  whatsapp   text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_own" ON clients;
CREATE POLICY "clients_select_own" ON clients FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_insert_own" ON clients;
CREATE POLICY "clients_insert_own" ON clients FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_update_own" ON clients;
CREATE POLICY "clients_update_own" ON clients FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_delete_own" ON clients;
CREATE POLICY "clients_delete_own" ON clients FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name    text NOT NULL,
  amount         integer NOT NULL CHECK (amount > 0),
  description    text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue')),
  pix_key        text,
  pix_copy_paste text,
  pix_qr_code    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_client_id_idx  ON transactions(client_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx     ON transactions(status);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON transactions;
CREATE POLICY "transactions_update_own" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON transactions;
CREATE POLICY "transactions_delete_own" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-update updated_at on all tables
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at    ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at     ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile row when a new user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, company_name, pix_key)
  VALUES (NEW.id, '', NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
