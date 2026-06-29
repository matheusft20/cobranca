import { supabase } from './supabase';
import { Client } from '@/src/types';

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createClient(
  fields: Pick<Client, 'name' | 'whatsapp' | 'email'>,
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(fields)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function searchClients(query: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function fetchClientWithTransactions(clientId: string) {
  const [clientRes, txRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
  ]);

  if (clientRes.error) throw clientRes.error;
  if (txRes.error) throw txRes.error;

  return { client: clientRes.data, transactions: txRes.data ?? [] };
}
