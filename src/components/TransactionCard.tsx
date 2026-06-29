import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Pressable } from 'react-native';
import { Check, X, ChevronDown } from 'lucide-react-native';
import { TransactionWithClient, TransactionStatus } from '@/src/types';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '@/src/utils/format';
import { supabase } from '@/src/services';

interface TransactionCardProps {
  item: TransactionWithClient;
  onPress?: () => void;
  onStatusChange?: () => void;
}

export function TransactionCard({ item, onPress, onStatusChange }: TransactionCardProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const initials = item.client_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  async function handleStatusChange(newStatus: TransactionStatus) {
    setShowPicker(false);
    if (newStatus === item.status) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', item.id);

      if (error) throw error;
      onStatusChange?.();
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível atualizar o status.');
    } finally {
      setLoading(false);
    }
  }

  function openStatusPicker() {
    setShowPicker(true);
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.client_name}</Text>
          {item.description ? (
            <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>

        <View style={styles.right}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <TouchableOpacity
            style={styles.statusRow}
            onPress={openStatusPicker}
            disabled={loading}
          >
            <StatusBadge status={item.status} />
            <ChevronDown size={14} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Status picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Alterar status</Text>
            <Text style={styles.modalSubtitle}>
              {formatCurrency(item.amount)} - {item.client_name}
            </Text>

            <TouchableOpacity
              style={[styles.statusOption, item.status === 'paid' && styles.statusOptionActive]}
              onPress={() => handleStatusChange('paid')}
            >
              <Check size={20} color={item.status === 'paid' ? '#FFFFFF' : '#059669'} />
              <Text style={[styles.statusOptionText, item.status === 'paid' && styles.statusOptionTextActive]}>
                Pago
              </Text>
              {item.status === 'paid' && <Check size={16} color="#FFFFFF" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, item.status === 'pending' && styles.statusOptionActive]}
              onPress={() => handleStatusChange('pending')}
            >
              <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.statusOptionText, item.status === 'pending' && styles.statusOptionTextActive]}>
                Pendente
              </Text>
              {item.status === 'pending' && <Check size={16} color="#FFFFFF" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, item.status === 'cancelled' && styles.statusOptionActive]}
              onPress={() => handleStatusChange('cancelled')}
            >
              <X size={20} color={item.status === 'cancelled' ? '#FFFFFF' : '#EF4444'} />
              <Text style={[styles.statusOptionText, item.status === 'cancelled' && styles.statusOptionTextActive]}>
                Cancelado
              </Text>
              {item.status === 'cancelled' && <Check size={16} color="#FFFFFF" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.cancelBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#0066FF',
  },
  info: { flex: 1, gap: 2 },
  name: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  right: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  amount: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
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
    maxWidth: 320,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    backgroundColor: '#F9FAFB',
  },
  statusOptionActive: {
    backgroundColor: '#0066FF',
  },
  statusOptionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
});
