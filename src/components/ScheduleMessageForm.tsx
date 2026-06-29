import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Calendar, Clock, Send, ChevronDown } from 'lucide-react-native';
import { Button } from './Button';

interface ScheduleMessageFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    message_text: string;
    send_date: string;
    send_time: string;
  }) => Promise<void>;
  clientName: string;
  clientWhatsapp?: string | null;
  loading?: boolean;
}

export function ScheduleMessageForm({
  visible,
  onClose,
  onSubmit,
  clientName,
  clientWhatsapp,
  loading = false,
}: ScheduleMessageFormProps) {
  const [messageText, setMessageText] = useState('');
  const [sendDate, setSendDate] = useState('');
  const [sendTime, setSendTime] = useState('09:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<{ message?: string; date?: string }>({});

  React.useEffect(() => {
    if (visible) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      setSendDate(dateStr);
      setMessageText('');
      setSendTime('09:00');
      setErrors({});
    }
  }, [visible]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!messageText.trim()) next.message = 'Digite a mensagem';
    if (!sendDate) next.date = 'Selecione uma data';
    else {
      const selected = new Date(sendDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) next.date = 'Data deve ser hoje ou futura';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      await onSubmit({
        message_text: messageText.trim(),
        send_date: sendDate,
        send_time: sendTime + ':00',
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível agendar a mensagem.');
    }
  }

  function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return 'Selecionar data';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatTimeDisplay(timeStr: string): string {
    if (!timeStr) return '09:00';
    const parts = timeStr.split(':');
    return `${parts[0]}:${parts[1]}`;
  }

  // Date picker days generation
  function generateDays() {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        day: date.getDate(),
        month: date.toLocaleDateString('pt-BR', { month: 'short' }),
        weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
      });
    }
    return days;
  }

  function generateTimes() {
    const times = [];
    for (let h = 6; h <= 22; h++) {
      times.push(`${String(h).padStart(2, '0')}:00`);
      times.push(`${String(h).padStart(2, '0')}:30`);
    }
    return times;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Agendar mensagem</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.clientInfo}>
              <Text style={styles.clientLabel}>Cliente:</Text>
              <Text style={styles.clientName}>{clientName}</Text>
              {clientWhatsapp && (
                <Text style={styles.clientWhatsapp}>{clientWhatsapp}</Text>
              )}
            </View>

            {/* Message input */}
            <View style={styles.field}>
              <Text style={styles.label}>Mensagem *</Text>
              <TextInput
                style={[styles.messageInput, errors.message && styles.inputError]}
                placeholder="Digite a mensagem que deseja enviar..."
                placeholderTextColor="#9CA3AF"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {errors.message && (
                <Text style={styles.errorText}>{errors.message}</Text>
              )}
            </View>

            {/* Quick templates */}
            <View style={styles.templatesRow}>
              <TouchableOpacity
                style={styles.templateChip}
                onPress={() => setMessageText(`Olá ${clientName.split(' ')[0]}! Lembrete: sua cobrança está aguardando pagamento.`)}
              >
                <Text style={styles.templateChipText}>Cobrança</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.templateChip}
                onPress={() => setMessageText(`Olá ${clientName.split(' ')[0]}! Passando para lembrar do nosso compromisso.`)}
              >
                <Text style={styles.templateChipText}>Lembrete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.templateChip}
                onPress={() => setMessageText(`Olá ${clientName.split(' ')[0]}! Tudo bem? Gostaria de agendar um horário?`)}
              >
                <Text style={styles.templateChipText}>Agendamento</Text>
              </TouchableOpacity>
            </View>

            {/* Date picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Data de envio *</Text>
              <TouchableOpacity
                style={[styles.pickerBtn, errors.date && styles.inputError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={18} color="#0066FF" />
                <Text style={styles.pickerBtnText}>{formatDateDisplay(sendDate)}</Text>
                <ChevronDown size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            {/* Time picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Horário</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowTimePicker(true)}
              >
                <Clock size={18} color="#0066FF" />
                <Text style={styles.pickerBtnText}>{formatTimeDisplay(sendTime)}</Text>
                <ChevronDown size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label="Cancelar"
              onPress={onClose}
              variant="secondary"
              style={styles.flexHalf}
            />
            <Button
              label="Agendar"
              onPress={handleSubmit}
              loading={loading}
              style={styles.flexHalf}
            />
          </View>
        </View>

        {/* Custom Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Selecionar data</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <X size={22} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.pickerList}
                showsVerticalScrollIndicator={false}
              >
                {generateDays().map((day) => (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.dateOption,
                      sendDate === day.date && styles.dateOptionSelected,
                    ]}
                    onPress={() => {
                      setSendDate(day.date);
                      setShowDatePicker(false);
                    }}
                  >
                    <View style={styles.dateOptionLeft}>
                      <Text style={styles.dateOptionDay}>{day.day}</Text>
                      <Text style={styles.dateOptionMonth}>{day.month}</Text>
                    </View>
                    <Text
                      style={[
                        styles.dateOptionWeekday,
                        sendDate === day.date && styles.dateOptionWeekdaySelected,
                      ]}
                    >
                      {day.weekday}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Custom Time Picker Modal */}
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Selecionar horário</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <X size={22} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.pickerList}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.timeGrid}>
                  {generateTimes().map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeOption,
                        sendTime === time && styles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setSendTime(time);
                        setShowTimePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          sendTime === time && styles.timeOptionTextSelected,
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 400,
  },
  bodyContent: {
    padding: 20,
  },
  clientInfo: {
    backgroundColor: '#EFF4FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 2,
  },
  clientLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  clientWhatsapp: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0066FF',
  },
  field: {
    marginBottom: 16,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  messageInput: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    backgroundColor: '#FAFBFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
  },
  templatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  templateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  templateChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: '#FAFBFF',
  },
  pickerBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  flexHalf: { flex: 1 },

  // Picker modals
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  pickerList: {
    padding: 16,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  dateOptionSelected: {
    backgroundColor: '#EFF4FF',
  },
  dateOptionLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  dateOptionDay: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  dateOptionMonth: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  dateOptionWeekday: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  dateOptionWeekdaySelected: {
    color: '#0066FF',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  timeOptionSelected: {
    backgroundColor: '#0066FF',
  },
  timeOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  timeOptionTextSelected: {
    color: '#FFFFFF',
  },
});
