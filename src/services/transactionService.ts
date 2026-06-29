import { supabase } from './supabase';
import { Transaction, TransactionWithClient } from '@/src/types';

export async function fetchRecentTransactions(limit = 20): Promise<TransactionWithClient[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, client:clients(id, name, whatsapp)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TransactionWithClient[];
}

export async function fetchDashboardSummary() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, status, created_at, paid_at');

  if (error) throw error;

  const rows = data ?? [];
  const receivedToday = rows
    .filter((r) => {
      if (r.status !== 'paid') return false;
      // Use paid_at if available, otherwise fall back to created_at
      const paymentDate = r.paid_at ? new Date(r.paid_at) : new Date(r.created_at);
      return paymentDate >= todayStart;
    })
    .reduce((sum, r) => sum + r.amount, 0);

  const pending = rows
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);

  return { receivedToday, pending };
}

export async function createTransaction(
  fields: Pick<
    Transaction,
    'client_id' | 'client_name' | 'amount' | 'description' | 'pix_key' | 'pix_copy_paste' | 'pix_qr_code'
  >,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...fields, status: 'pending' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransactionStatus(
  id: string,
  status: Transaction['status'],
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
