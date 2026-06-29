import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Building2, Key } from 'lucide-react-native';
import { supabase, upsertProfile } from '@/src/services';
import { useAuthStore } from '@/src/store/authStore';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';

export default function OnboardingScreen() {
  const { user, setProfile } = useAuthStore();
  const [companyName, setCompanyName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ companyName?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (!companyName.trim()) next.companyName = 'Informe o nome da empresa';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      const profile = await upsertProfile(user.id, {
        company_name: companyName.trim(),
        pix_key: pixKey.trim() || null,
      });
      setProfile(profile);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err.message ?? 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (!user) return;
    try {
      const profile = await upsertProfile(user.id, { company_name: 'Minha Empresa' });
      setProfile(profile);
    } catch {
      // non-critical, proceed anyway
    }
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Ultimo passo</Text>
          </View>
          <Text style={styles.title}>Configure sua conta</Text>
          <Text style={styles.subtitle}>
            Estas informacoes aparecerao nas suas cobranças
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldIcon}>
              <Building2 size={20} color="#0066FF" />
            </View>
            <View style={styles.fieldInput}>
              <Input
                label="Nome da empresa ou seu nome"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Ex: João Eletricista"
                error={errors.companyName}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldIcon}>
              <Key size={20} color="#0066FF" />
            </View>
            <View style={styles.fieldInput}>
              <Input
                label="Chave PIX padrão (opcional)"
                value={pixKey}
                onChangeText={setPixKey}
                placeholder="CPF, e-mail, celular ou chave aleatória"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>

          <View style={styles.pixHint}>
            <Text style={styles.pixHintText}>
              Voce podera alterar essa chave a qualquer momento nas configuracoes.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Salvar e continuar" onPress={handleSave} loading={loading} />
          <Button label="Fazer isso depois" onPress={handleSkip} variant="ghost" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: { gap: 10 },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF4FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#0066FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  form: { gap: 20, marginTop: 40 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  fieldInput: { flex: 1 },
  pixHint: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
  },
  pixHintText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 19,
  },
  actions: { gap: 8, marginTop: 40 },
});
