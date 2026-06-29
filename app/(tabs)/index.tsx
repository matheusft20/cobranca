import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, TrendingUp, Clock, Settings } from 'lucide-react-native';
import { useAuthStore } from '@/src/store/authStore';
import { useDashboardStore } from '@/src/store/dashboardStore';
import { TransactionCard } from '@/src/components/TransactionCard';
import { ReminderCard } from '@/src/components/ReminderCard';
import { TransactionWithClient, ScheduledMessage } from '@/src/types';
import { formatCurrency } from '@/src/utils/format';
import { fetchDueReminders, dismissReminder } from '@/src/services';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { transactions, receivedToday, pending, loading, error, refresh, setupRealtime } = useDashboardStore();

  // Reminders state
  const [reminders, setReminders] = useState<(ScheduledMessage & { client_name: string; client_whatsapp: string | null })[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);

  useEffect(() => {
    refresh();

    // Setup realtime subscription for live updates
    const cleanup = setupRealtime();

    return () => {
      cleanup();
    };
  }, []);

  // Fetch due reminders
  const fetchReminders = useCallback(async () => {
    setRemindersLoading(true);
    try {
      const data = await fetchDueReminders();
      setReminders(data);
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  // Fetch reminders on mount and periodically
  useEffect(() => {
    fetchReminders();
    // Check for reminders every minute
    const interval = setInterval(fetchReminders, 60000);
    return () => clearInterval(interval);
  }, [fetchReminders]);

  const handleDismissReminder = useCallback(async (id: string) => {
    try {
      await dismissReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TransactionWithClient }) => (
      <TransactionCard item={item} onStatusChange={refresh} />
    ),
    [refresh],
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Nenhuma cobrança ainda</Text>
        <Text style={styles.emptySubtitle}>
          Toque no botão + para criar sua primeira cobrança
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá,</Text>
          <Text style={styles.companyName} numberOfLines={1}>
            {profile?.company_name || 'Minha Empresa'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/settings')}
          style={styles.signOutBtn}
        >
          <Settings size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#0066FF" />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.summaryCardBlue]}>
                <View style={styles.summaryIconBox}>
                  <TrendingUp size={18} color="#0066FF" />
                </View>
                <Text style={styles.summaryLabel}>Recebidos hoje</Text>
                {loading && transactions.length === 0 ? (
                  <ActivityIndicator color="#0066FF" size="small" style={{ marginTop: 4 }} />
                ) : (
                  <Text style={[styles.summaryValue, styles.summaryValueBlue]}>
                    {formatCurrency(receivedToday)}
                  </Text>
                )}
              </View>

              <View style={[styles.summaryCard, styles.summaryCardAmber]}>
                <View style={[styles.summaryIconBox, styles.summaryIconBoxAmber]}>
                  <Clock size={18} color="#B45309" />
                </View>
                <Text style={styles.summaryLabel}>Aguardando</Text>
                {loading && transactions.length === 0 ? (
                  <ActivityIndicator color="#B45309" size="small" style={{ marginTop: 4 }} />
                ) : (
                  <Text style={[styles.summaryValue, styles.summaryValueAmber]}>
                    {formatCurrency(pending)}
                  </Text>
                )}
              </View>
            </View>

            {/* Reminders Section */}
            {reminders.length > 0 && (
              <View style={styles.remindersSection}>
                {reminders.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    id={reminder.id}
                    clientName={reminder.client_name}
                    clientWhatsapp={reminder.client_whatsapp}
                    messageText={reminder.message_text}
                    onDismiss={handleDismissReminder}
                  />
                ))}
              </View>
            )}

            {/* Section title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Últimas transações</Text>
              {error ? (
                <TouchableOpacity onPress={refresh}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => router.push('/(tabs)/new-charge')}
        activeOpacity={0.85}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F5F7FB',
  },
  greeting: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    maxWidth: 220,
  },
  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  summaryCardBlue: {
    backgroundColor: '#EFF4FF',
  },
  summaryCardAmber: {
    backgroundColor: '#FFFBEB',
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconBoxAmber: {
    backgroundColor: '#FDE68A',
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
  },
  summaryValueBlue: {
    color: '#0066FF',
  },
  summaryValueAmber: {
    color: '#B45309',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  remindersSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  retryText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0066FF',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 56,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 21,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
});
