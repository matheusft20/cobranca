import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TransactionStatus } from '@/src/types';

const CONFIG: Record<TransactionStatus, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Aguardando', bg: '#FFF8E7', text: '#B45309' },
  paid:      { label: 'Recebido',   bg: '#ECFDF5', text: '#065F46' },
  cancelled: { label: 'Cancelado',  bg: '#FEF2F2', text: '#B91C1C' },
  overdue:   { label: 'Vencido',    bg: '#FFF1F2', text: '#BE123C' },
  failed:    { label: 'Falhou',     bg: '#FEF2F2', text: '#991B1B' },
  refunded:  { label: 'Devolvido',  bg: '#F3F4F6', text: '#4B5563' },
};

interface StatusBadgeProps {
  status: TransactionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
});
