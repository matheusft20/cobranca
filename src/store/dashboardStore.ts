import { create } from 'zustand';
import { supabase } from '@/src/services';
import { TransactionWithClient, TransactionStatus } from '@/src/types';
import { fetchRecentTransactions, fetchDashboardSummary } from '@/src/services';

interface DashboardState {
  transactions: TransactionWithClient[];
  receivedToday: number;
  pending: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setupRealtime: () => () => void;
  markAsPaid: (transactionId: string) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  transactions: [],
  receivedToday: 0,
  pending: 0,
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [transactions, summary] = await Promise.all([
        fetchRecentTransactions(20),
        fetchDashboardSummary(),
      ]);
      set({
        transactions,
        receivedToday: summary.receivedToday,
        pending: summary.pending,
        loading: false,
      });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Erro ao carregar dados' });
    }
  },

  markAsPaid: (transactionId: string) => {
    const { transactions } = get();
    const now = new Date().toISOString();
    const updatedTransactions = transactions.map((tx) =>
      tx.id === transactionId
        ? { ...tx, status: 'paid' as TransactionStatus, paid_at: now }
        : tx
    );
    set({ transactions: updatedTransactions });

    // Recalculate summary based on paid_at
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const receivedToday = updatedTransactions
      .filter((r) => {
        if (r.status !== 'paid') return false;
        const paymentDate = r.paid_at ? new Date(r.paid_at) : new Date(r.created_at);
        return paymentDate >= todayStart;
      })
      .reduce((sum, r) => sum + r.amount, 0);

    const pending = updatedTransactions
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + r.amount, 0);

    set({ receivedToday, pending });
  },

  setupRealtime: () => {
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
        },
        (payload: { new: { id: string; status: TransactionStatus; paid_at: string | null } }) => {
          const { id, status, paid_at } = payload.new;
          if (status) {
            // Update local state with new status and paid_at
            const { transactions } = get();
            const updatedTransactions = transactions.map((tx) =>
              tx.id === id ? { ...tx, status, paid_at } : tx
            );
            set({ transactions: updatedTransactions });

            // Recalculate summary based on paid_at
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const receivedToday = updatedTransactions
              .filter((r) => {
                if (r.status !== 'paid') return false;
                const paymentDate = r.paid_at ? new Date(r.paid_at) : new Date(r.created_at);
                return paymentDate >= todayStart;
              })
              .reduce((sum, r) => sum + r.amount, 0);

            const pending = updatedTransactions
              .filter((r) => r.status === 'pending')
              .reduce((sum, r) => sum + r.amount, 0);

            set({ receivedToday, pending });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          // Refresh to get the new transaction with client data
          get().refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
