/*
# Mercado Pago Integration Schema

## Visao Geral
Adiciona suporte a integracao real com Mercado Pago:
1. Armazena credenciais MP do usuario (access_token)
2. Rastreia pagamentos externos (external_reference, payment_url, payment_id)
3. Habilita baixa automatica via webhook

## Alteracoes

### 1. profiles (ALTER)
- `mp_access_token` (text, nullable) — Access Token do MP (Production)
- Armazenado em texto simples para o MVP (em producao, usar Supabase Vault)

### 2. transactions (ALTER)
- `external_reference` (text, nullable) — preference_id retornado pelo MP
- `payment_url` (text, nullable) — URL do Checkout Pro (init_point)
- `payment_id` (bigint, nullable) — ID do pagamento aprovado no MP
- `mp_status` (text, nullable) — Status bruto retornado pelo MP (pending, approved, cancelled, refunded, etc)
- `paid_at` (timestamptz, nullable) — Data/hora em que o pagamento foi confirmado

### 3. RLS Policy for Webhook
- Permite que a Edge Function (service role) atualize transacoes
- Os campos de update agora aceitam chamadas de service_role

## Seguranca
- O mp_access_token e sensivel - nunca e exposto ao cliente
- A Edge Function usa SUPABASE_SERVICE_ROLE_KEY para acessar e atualizar
- O webhook valida a assinatura do Mercado Pago
*/

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ADICIONAR COLUNAS NA TABELA profiles
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mp_access_token text;

COMMENT ON COLUMN profiles.mp_access_token IS 'Access Token do Mercado Pago (Production). Armazenar em Supabase Vault em producao.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ADICIONAR COLUNAS NA TABELA transactions
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS external_reference text,
ADD COLUMN IF NOT EXISTS payment_url text,
ADD COLUMN IF NOT EXISTS payment_id bigint,
ADD COLUMN IF NOT EXISTS mp_status text,
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN transactions.external_reference IS 'ID da Preference criada no Mercado Pago (checkout preference ID)';
COMMENT ON COLUMN transactions.payment_url IS 'URL do Checkout Pro (init_point) para enviar ao cliente';
COMMENT ON COLUMN transactions.payment_id IS 'ID do pagamento no MP quando aprovado';
COMMENT ON COLUMN transactions.mp_status IS 'Status bruto do Mercado Pago: pending, approved, authorized, in_process, in_mediation, rejected, cancelled, refunded, charged_back';
COMMENT ON COLUMN transactions.paid_at IS 'Timestamp quando o pagamento foi confirmado (webhook received)';

-- Indices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_transactions_external_reference ON transactions(external_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON transactions(payment_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. POLITICA RLS PARA WEBHOOK (service_role pode atualizar)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Permite que a Edge Function (usando service_role) atualize transacoes
-- Isso e necessario porque o webhook nao tem um usuario autenticado
DROP POLICY IF EXISTS "transactions_update_service_role" ON transactions;
CREATE POLICY "transactions_update_service_role" ON transactions FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);

-- Permite que a Edge Function leia o mp_access_token do usuario
DROP POLICY IF EXISTS "profiles_select_service_role" ON profiles;
CREATE POLICY "profiles_select_service_role" ON profiles FOR SELECT
  TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. TRIGGER PARA SUPABASE REALTIME
-- ═══════════════════════════════════════════════════════════════════════════════

-- Habilita Realtime na tabela transactions para que o app receba
-- atualizacoes instantaneas quando o webhook atualizar o status
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. FUNCAO HELPER PARA O WEBHOOK
-- ═══════════════════════════════════════════════════════════════════════════════

-- Funcao para atualizar status de pagamento
-- Chamada pela Edge Function mp-webhook
CREATE OR REPLACE FUNCTION update_transaction_payment(
  p_transaction_id uuid,
  p_payment_id bigint,
  p_mp_status text,
  p_new_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE transactions
  SET
    payment_id = p_payment_id,
    mp_status = p_mp_status,
    status = p_new_status,
    paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = p_transaction_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. ATUALIZAR CONSTRAINT DE STATUS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Adiciona novos status possiveis originados do MP
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue', 'failed', 'refunded'));
