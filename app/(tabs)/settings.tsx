import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Key, Building2, ExternalLink, Shield, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { useAuthStore } from '@/src/store/authStore';
import { supabase, fetchProfile, upsertProfile } from '@/src/services';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, setProfile } = useAuthStore();

  const [companyName, setCompanyName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ companyName?: string }>({});

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchProfile(user.id);
      if (data) {
        setCompanyName(data.company_name || '');
        setPixKey(data.pix_key || '');
        setMpAccessToken(data.mp_access_token || '');
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!companyName.trim()) next.companyName = 'Informe o nome da empresa';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate() || !user) return;

    setSaving(true);
    try {
      const updated = await upsertProfile(user.id, {
        company_name: companyName.trim(),
        pix_key: pixKey.trim() || null,
        mp_access_token: mpAccessToken.trim() || null,
      });
      setProfile(updated);
      Alert.alert('Salvo', 'Configurações atualizadas com sucesso!');
      router.back();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err.message ?? 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Sair da conta',
      'Deseja realmente sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  function openMpDocs() {
    // Link to MP credentials docs
    Alert.alert(
      'Mercado Pago',
      'Para obter suas credenciais, acesse:\n\nhttps://www.mercadopago.com.br/developers/panel/app'
    );
  }

  const hasMpToken = mpAccessToken.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configurações</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#0066FF" size="large" style={{ marginTop: 48 }} />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Business Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dados do negócio</Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Building2 size={20} color="#0066FF" />
                </View>
                <View style={styles.fieldInput}>
                  <Input
                    label="Nome da empresa"
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
                    returnKeyType="next"
                  />
                </View>
              </View>
            </View>

            {/* Mercado Pago Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Integração Mercado Pago</Text>
                <TouchableOpacity onPress={openMpDocs}>
                  <ExternalLink size={18} color="#0066FF" />
                </TouchableOpacity>
              </View>

              <View style={styles.mpStatusCard}>
                <View style={styles.mpStatusHeader}>
                  {hasMpToken ? (
                    <>
                      <CheckCircle size={20} color="#059669" />
                      <Text style={styles.mpStatusActive}>Integração ativa</Text>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={20} color="#F59E0B" />
                      <Text style={styles.mpStatusInactive}>Configure para receber pagamentos</Text>
                    </>
                  )}
                </View>
                <Text style={styles.mpStatusDesc}>
                  {hasMpToken
                    ? 'Suas cobranças usarão o Checkout Pro do Mercado Pago.'
                    : 'Sem o token, as cobranças usarão PIX estático (manual).'}
                </Text>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Shield size={20} color="#0066FF" />
                </View>
                <View style={styles.fieldInput}>
                  <Input
                    label="Access Token (Produção)"
                    value={mpAccessToken}
                    onChangeText={setMpAccessToken}
                    placeholder="APP_USR-xxxx-xxxx-xxxx-xxxx"
                    isPassword
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
              </View>

              <View style={styles.mpWarning}>
                <Text style={styles.mpWarningTitle}>Onde encontrar:</Text>
                <Text style={styles.mpWarningText}>
                  1. Acesse o painel de desenvolvedor do MP{'\n'}
                  2. Crie ou selecione uma aplicação{'\n'}
                  3. Copie o Access Token de Produção
                </Text>
              </View>
            </View>

            {/* Save Button */}
            <Button
              label="Salvar configurações"
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />

            {/* Sign Out */}
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sair da conta</Text>
            </TouchableOpacity>

            {/* App version */}
            <Text style={styles.version}>versão 1.0.0</Text>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F5F7FB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F7FB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },

  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
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

  // MP Status Card
  mpStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mpStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mpStatusActive: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
  },
  mpStatusInactive: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#F59E0B',
  },
  mpStatusDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },

  // MP Warning
  mpWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    marginTop: 8,
  },
  mpWarningTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
  },
  mpWarningText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    lineHeight: 18,
  },

  saveButton: {
    marginTop: 8,
    marginBottom: 24,
  },

  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#EF4444',
  },

  version: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});
