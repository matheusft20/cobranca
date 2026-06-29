// Database types — auto-maintained to match the Supabase schema

export type TransactionStatus = 'pending' | 'paid' | 'cancelled' | 'overdue' | 'failed' | 'refunded';

export interface Profile {
  id: string; // references auth.users.id
  company_name: string;
  pix_key: string | null;
  mp_access_token: string | null; // Mercado Pago Access Token (stored securely)
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string; // denormalized for speed
  amount: number; // stored in cents (BRL)
  description: string | null;
  status: TransactionStatus;
  pix_key: string | null;
  pix_copy_paste: string | null;
  pix_qr_code: string | null;
  // Mercado Pago integration fields
  external_reference: string | null; // MP preference ID
  payment_url: string | null; // Checkout Pro URL
  payment_id: number | null; // MP payment ID
  mp_status: string | null; // Raw MP status
  paid_at: string | null; // When payment was confirmed
  created_at: string;
  updated_at: string;
}

// Joined query result: transaction with client details
export interface TransactionWithClient extends Transaction {
  client: Pick<Client, 'id' | 'name' | 'whatsapp'> | null;
}

// Products/Services catalog
export interface Product {
  id: string;
  user_id: string;
  name: string;
  price: number; // stored in cents (BRL)
  quantity: number;
  created_at: string;
  updated_at: string;
}

// Scheduled messages/reminders
export interface ScheduledMessage {
  id: string;
  user_id: string;
  client_id: string;
  transaction_id: string | null;
  message_text: string;
  send_date: string; // ISO date string (YYYY-MM-DD)
  send_time: string; // time string (HH:mm:ss)
  is_active: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}
