import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { Bell, MessageCircle, X, Check } from 'lucide-react-native';
import { formatWhatsApp } from '@/src/utils/format';

interface ReminderCardProps {
  id: string;
  clientName: string;
  clientWhatsapp: string | null;
  messageText: string;
  onDismiss: (id: string) => void;
}

export function ReminderCard({
  id,
  clientName,
  clientWhatsapp,
  messageText,
  onDismiss,
}: ReminderCardProps) {
  function handleOpenWhatsApp() {
    if (!clientWhatsapp) return;
    const number = formatWhatsApp(clientWhatsapp).replace('+', '');
    const msg = encodeURIComponent(messageText);
    Linking.openURL(`https://wa.me/${number}?text=${msg}`);
  }

  function handleDismiss() {
    onDismiss(id);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Bell size={18} color="#FFFFFF" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Lembrete de Cobrança</Text>
          <Text style={styles.clientName}>{clientName}</Text>
        </View>
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.messageBox}>
        <Text style={styles.messageText} numberOfLines={3}>
          {messageText}
        </Text>
      </View>

      <View style={styles.actions}>
        {clientWhatsapp ? (
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleOpenWhatsApp}>
            <MessageCircle size={18} color="#FFFFFF" />
            <Text style={styles.whatsappBtnText}>Abrir WhatsApp</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noWhatsappHint}>
            <Text style={styles.noWhatsappText}>Cliente sem WhatsApp cadastrado</Text>
          </View>
        )}
        <TouchableOpacity style={styles.doneBtn} onPress={handleDismiss}>
          <Check size={16} color="#059669" />
          <Text style={styles.doneBtnText}>Feito</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B45309',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 10,
  },
  whatsappBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  noWhatsappHint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
  },
  noWhatsappText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
  },
});
