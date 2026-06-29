import { supabase } from './supabase';
import { ScheduledMessage } from '@/src/types';

export async function fetchScheduledMessages(): Promise<ScheduledMessage[]> {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .order('send_date', { ascending: true })
    .order('send_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchDueReminders(): Promise<(ScheduledMessage & { client_name: string; client_whatsapp: string | null })[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:mm

  const { data, error } = await supabase
    .from('scheduled_messages')
    .select(`
      *,
      client:clients(name, whatsapp)
    `)
    .eq('is_active', true)
    .or(`send_date.lt.${today},and(send_date.eq.${today},send_time.lte.${currentTime})`)
    .order('send_date', { ascending: true })
    .order('send_time', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((item) => ({
    ...item,
    client_name: item.client?.name ?? 'Cliente',
    client_whatsapp: item.client?.whatsapp ?? null,
  }));
}

export async function dismissReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_messages')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchScheduledMessagesByClient(
  clientId: string,
): Promise<ScheduledMessage[]> {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('client_id', clientId)
    .order('send_date', { ascending: true })
    .order('send_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchScheduledMessage(
  id: string,
): Promise<ScheduledMessage | null> {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createScheduledMessage(fields: {
  client_id: string;
  transaction_id?: string | null;
  message_text: string;
  send_date: string;
  send_time: string;
  is_active?: boolean;
}): Promise<ScheduledMessage> {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .insert({
      ...fields,
      transaction_id: fields.transaction_id ?? null,
      is_active: fields.is_active ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScheduledMessage(
  id: string,
  fields: Partial<
    Pick<
      ScheduledMessage,
      'message_text' | 'send_date' | 'send_time' | 'is_active'
    >
  >,
): Promise<ScheduledMessage> {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteScheduledMessage(id: string): Promise<void> {
  const { error, data } = await supabase
    .from('scheduled_messages')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    throw new Error(error.message || 'Erro ao excluir mensagem');
  }
  if (!data || data.length === 0) {
    throw new Error('Mensagem não encontrada ou você não tem permissão para excluí-la.');
  }
}

export async function toggleScheduledMessage(
  id: string,
  isActive: boolean,
): Promise<ScheduledMessage> {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
