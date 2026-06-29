import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Clock, Calendar, Bell, BellOff, Trash2, Send } from 'lucide-react-native';
import { ScheduledMessage } from '@/src/types';

interface ScheduledMessageCardProps {
  message: ScheduledMessage;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ScheduledMessageCard({
  message,
  onToggle,
  onDelete,
}: ScheduledMessageCardProps) {
  const isSent = message.sent_at !== null;

  function formatDateDisplay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatTimeDisplay(timeStr: string): string {
    return timeStr.substring(0, 5);
  }

  async function handleToggle() {
    try {
      await onToggle(message.id, !message.is_active);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível atualizar a mensagem.');
    }
  }

  function handleDelete() {
    Alert.alert(
      'Excluir mensagem',
      'Deseja realmente excluir esta mensagem agendada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(message.id);
            } catch (err: any) {
              const errorMsg = err?.message || err?.details || 'Não foi possível excluir a mensagem. Verifique se você tem permissão.';
              Alert.alert('Erro', errorMsg);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.card, isSent && styles.cardSent, !message.is_active && styles.cardInactive]}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          {isSent ? (
            <View style={[styles.statusBadge, styles.statusBadgeSent]}>
              <Send size={12} color="#FFFFFF" />
              <Text style={styles.statusTextSent}>Enviada</Text>
            </View>
          ) : message.is_active ? (
            <View style={[styles.statusBadge, styles.statusBadgeActive]}>
              <Bell size={12} color="#0066FF" />
              <Text style={styles.statusTextActive}>Agendada</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.statusBadgeInactive]}>
              <BellOff size={12} color="#6B7280" />
              <Text style={styles.statusTextInactive}>Pausada</Text>
            </View>
          )}
        </View>

        {!isSent && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={handleToggle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {message.is_active ? (
                <BellOff size={18} color="#6B7280" />
              ) : (
                <Bell size={18} color="#0066FF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.messageText} numberOfLines={3}>
        {message.message_text}
      </Text>

      <View style={styles.footer}>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeItem}>
            <Calendar size={14} color="#9CA3AF" />
            <Text style={styles.dateTimeText}>
              {formatDateDisplay(message.send_date)}
            </Text>
          </View>
          <View style={styles.dateTimeItem}>
            <Clock size={14} color="#9CA3AF" />
            <Text style={styles.dateTimeText}>
              {formatTimeDisplay(message.send_time)}
            </Text>
          </View>
        </View>
        {isSent && message.sent_at && (
          <Text style={styles.sentAt}>
            Enviada em {new Date(message.sent_at).toLocaleString('pt-BR')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSent: {
    opacity: 0.8,
  },
  cardInactive: {
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusBadgeActive: {
    backgroundColor: '#EFF4FF',
  },
  statusBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusBadgeSent: {
    backgroundColor: '#059669',
  },
  statusTextActive: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#0066FF',
  },
  statusTextInactive: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  statusTextSent: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  sentAt: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
});
