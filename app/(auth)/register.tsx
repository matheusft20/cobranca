import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { supabase } from '@/src/services';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
  }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Informe seu e-mail';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'E-mail inválido';
    if (!password) next.password = 'Informe uma senha';
    else if (password.length < 6) next.password = 'Mínimo 6 caracteres';
    if (!confirm) next.confirm = 'Confirme sua senha';
    else if (confirm !== password) next.confirm = 'As senhas não coincidem';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: undefined },
      });
      if (error) throw error;
      // Trigger auto-creates profile row; navigate to onboarding
      router.replace('/(auth)/onboarding');
    } catch (err: any) {
      const msg =
        err.message?.includes('already registered')
          ? 'Este e-mail já está cadastrado.'
          : (err.message ?? 'Tente novamente.');
      Alert.alert('Erro ao criar conta', msg);
    } finally {
      setLoading(false);
    }
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
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#374151" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Crie sua conta</Text>
          <Text style={styles.subtitle}>Comece a gerenciar suas cobranças hoje</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="seu@email.com"
            error={errors.email}
            returnKeyType="next"
          />
          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            isPassword
            error={errors.password}
            returnKeyType="next"
          />
          <Input
            label="Confirmar senha"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repita a senha"
            isPassword
            error={errors.confirm}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
          <Button label="Criar conta" onPress={handleRegister} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta?</Text>
          <Button
            label="Entrar"
            onPress={() => router.replace('/(auth)/login')}
            variant="ghost"
          />
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
    paddingTop: 56,
    paddingBottom: 40,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  header: { gap: 8, marginBottom: 32 },
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
  form: { gap: 16 },
  footer: { alignItems: 'center', gap: 4, marginTop: 40 },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});
