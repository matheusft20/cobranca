import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Phone, Bell, Plus, CreditCard as Edit2, X, Check } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { fetchClientWithTransactions, supabase } from '@/src/services';
import {
  fetchScheduledMessagesByClient,
  createScheduledMessage,
  toggleScheduledMessage,
  deleteScheduledMessage,
} from '@/src/services/scheduledMessageService';
import { Client, Transaction, ScheduledMessage } from '@/src/types';
import { StatusBadge } from '@/src/components/StatusBadge';
import { ScheduleMessageForm } from '@/src/components/ScheduleMessageForm';
import { ScheduledMessageCard } from '@/src/components/ScheduledMessageCard';
import { formatCurrency, formatDate } from '@/src/utils/format';

export default function ClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);

  // WhatsApp edit state
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await fetchClientWithTransactions(id);
      setClient(result.client);
      setTransactions(result.transactions);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível carregar o cliente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadScheduledMessages = useCallback(async () => {
    if (!id) return;
    setMessagesLoading(true);
    try {
      const messages = await fetchScheduledMessagesByClient(id);
      setScheduledMessages(messages);
    } catch (err: any) {
      // non-critical, don't show alert
    } finally {
      setMessagesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClient();
    loadScheduledMessages();
  }, [loadClient, loadScheduledMessages]);

  const totalPaid = transactions
    .filter((t) => t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const openWhatsApp = () => {
    if (!client?.whatsapp) return;
    const digits = client.whatsapp.replace(/\D/g, '');
    const number = digits.startsWith('55') ? digits : `55${digits}`;
    Linking.openURL(`https://wa.me/${number}`);
  };

  const handleCreateMessage = async (data: {
    message_text: string;
    send_date: string;
    send_time: string;
  }) => {
    if (!id) return;
    setSavingMessage(true);
    try {
      await createScheduledMessage({
        client_id: id,
        message_text: data.message_text,
        send_date: data.send_date,
        send_time: data.send_time,
        is_active: true,
      });
      await loadScheduledMessages();
    } finally {
      setSavingMessage(false);
    }
  };

  const handleToggleMessage = async (messageId: string, isActive: boolean) => {
    await toggleScheduledMessage(messageId, isActive);
    await loadScheduledMessages();
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteScheduledMessage(messageId);
      await loadScheduledMessages();
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível excluir a mensagem.');
    }
  };

  // WhatsApp edit handlers
  const handleOpenWhatsappModal = () => {
    setWhatsappInput(client?.whatsapp || '');
    setShowWhatsappModal(true);
  };

  const handleSaveWhatsapp = async () => {
    if (!id) return;
    setSavingWhatsapp(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ whatsapp: whatsappInput.trim() || null })
        .eq('id', id);

      if (error) throw error;

      setClient((prev) =>
        prev ? { ...prev, whatsapp: whatsappInput.trim() || null } : null
      );
      setShowWhatsappModal(false);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível atualizar o WhatsApp.');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.txRow}>
      <View style={styles.txLeft}>
        <Text style={styles.txDesc} numberOfLines={1}>
          {item.description || 'Cobrança'}
        </Text>
        <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={styles.txAmount}>{formatCurrency(item.amount)}</Text>
        <StatusBadge status={item.status} />
      </View>
    </View>
  );

  const renderScheduledMessage = ({ item }: { item: ScheduledMessage }) => (
    <ScheduledMessageCard
      message={item}
      onToggle={handleToggleMessage}
      onDelete={handleDeleteMessage}
    />
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#0066FF" size="large" />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Cliente não encontrado.</Text>
      </View>
    );
  }

  const initials = client.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const pendingMessages = scheduledMessages.filter(
    (m) => m.is_active && !m.sent_at,
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <>
            {/* Nav */}
            <View style={styles.nav}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <ChevronLeft size={22} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.navTitle}>Perfil do cliente</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Profile card */}
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{initials}</Text>
              </View>
              <Text style={styles.profileName}>{client.name}</Text>

              {/* WhatsApp row with edit button */}
              <TouchableOpacity style={styles.phoneRow} onPress={handleOpenWhatsappModal}>
                <Phone size={14} color={client.whatsapp ? '#0066FF' : '#9CA3AF'} />
                <Text style={[styles.phoneText, !client.whatsapp && styles.phoneTextPlaceholder]}>
                  {client.whatsapp || 'Adicionar WhatsApp'}
                </Text>
                <Edit2 size={14} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{transactions.length}</Text>
                  <Text style={styles.statLabel}>Cobranças</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#059669' }]}>
                    {formatCurrency(totalPaid)}
                  </Text>
                  <Text style={styles.statLabel}>Total recebido</Text>
                </View>
              </View>
            </View>

            {/* Scheduled Messages Section */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Bell size={18} color="#0066FF" />
                <Text style={styles.sectionTitle}>Mensagens agendadas</Text>
                {pendingMessages.length > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pendingMessages.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.addMessageBtn}
                onPress={() => setShowScheduleForm(true)}
              >
                <Plus size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {messagesLoading ? (
              <ActivityIndicator color="#0066FF" style={{ marginVertical: 16 }} />
            ) : scheduledMessages.length > 0 ? (
              <FlatList
                data={scheduledMessages}
                keyExtractor={(item) => item.id}
                renderItem={renderScheduledMessage}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyMessagesText}>
                  Nenhuma mensagem agendada
                </Text>
                <TouchableOpacity
                  style={styles.emptyMessagesBtn}
                  onPress={() => setShowScheduleForm(true)}
                >
                  <Text style={styles.emptyMessagesBtnText}>Agendar mensagem</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Transactions Section */}
            {transactions.length > 0 ? (
              <Text style={styles.sectionTitleTx}>Histórico de cobranças</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sem cobranças</Text>
            <Text style={styles.emptySubtitle}>
              Nenhuma cobrança gerada para este cliente ainda.
            </Text>
          </View>
        }
      />

      {/* Schedule Message Form Modal */}
      <ScheduleMessageForm
        visible={showScheduleForm}
        onClose={() => setShowScheduleForm(false)}
        onSubmit={handleCreateMessage}
        clientName={client.name}
        clientWhatsapp={client.whatsapp}
        loading={savingMessage}
      />

      {/* WhatsApp Edit Modal */}
      <Modal
        visible={showWhatsappModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWhatsappModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>WhatsApp do cliente</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowWhatsappModal(false)}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Informe o número para contato via WhatsApp
            </Text>

            <TextInput
              style={styles.modalInput}
              value={whatsappInput}
              onChangeText={setWhatsappInput}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowWhatsappModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveWhatsapp}
                disabled={savingWhatsapp}
              >
                {savingWhatsapp ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.modalSaveText}>Salvar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: '#EF4444', fontFamily: 'Inter-Regular' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  listContent: { paddingHorizontal: 16 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  profileAvatarText: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#0066FF',
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EFF4FF',
    borderRadius: 20,
  },
  phoneText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0066FF',
  },
  phoneTextPlaceholder: {
    color: '#9CA3AF',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  pendingBadge: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  addMessageBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessages: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  emptyMessagesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emptyMessagesBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#EFF4FF',
  },
  emptyMessagesBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#0066FF',
  },
  sectionTitleTx: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  txLeft: { flex: 1, gap: 3 },
  txDesc: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  txDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 6,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  // WhatsApp edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    backgroundColor: '#FAFBFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  modalSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0066FF',
  },
  modalSaveText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
