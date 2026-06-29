import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, X, Search, UserPlus, Check, Package, CreditCard, Link as LinkIcon } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';

import { useAuthStore } from '@/src/store/authStore';
import { useDashboardStore } from '@/src/store/dashboardStore';
import { searchClients, createClient, createTransaction, searchProducts } from '@/src/services';
import { supabase } from '@/src/services';
import { Client, Transaction, Product } from '@/src/types';
import { formatCurrency, formatWhatsApp } from '@/src/utils/format';
import { mockPixPayload } from '@/src/utils/pixMock';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'value' | 'client' | 'success';

interface NewClientForm {
  name: string;
  whatsapp: string;
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={dotStyles.row}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i <= current ? dotStyles.dotActive : dotStyles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#0066FF', width: 20 },
  dotInactive: { backgroundColor: '#DDE3EE' },
});

// ─── Currency input helper ────────────────────────────────────────────────────

function parseCents(value: string): number {
  const digits = value.replace(/\D/g, '');
  return parseInt(digits || '0', 10);
}

function formatCentsInput(cents: number): string {
  if (cents === 0) return '';
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NewChargeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { refresh } = useDashboardStore();

  // Navigation state
  const [step, setStep] = useState<Step>('value');

  // Step 1 — value & description
  const [cents, setCents] = useState(0);
  const [description, setDescription] = useState('');
  const [valueError, setValueError] = useState('');
  const [useProductMode, setUseProductMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const productSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — client
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>({ name: '', whatsapp: '' });
  const [newClientErrors, setNewClientErrors] = useState<Partial<NewClientForm>>({});
  const [clientLoading, setClientLoading] = useState(false);

  // Step 3 — success
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Product selection handlers ──

  function handleToggleProductMode() {
    setUseProductMode((prev) => !prev);
    if (!useProductMode) {
      setSelectedProducts([]);
      setProductQuery('');
      setProductResults([]);
      setCents(0);
      setDescription('');
    }
  }

  function handleProductQueryChange(text: string) {
    setProductQuery(text);

    if (productSearchTimeout.current) clearTimeout(productSearchTimeout.current);
    if (!text.trim()) {
      setProductResults([]);
      return;
    }
    productSearchTimeout.current = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const data = await searchProducts(text.trim());
        setProductResults(data);
      } catch {
        // non-critical
      } finally {
        setProductSearchLoading(false);
      }
    }, 300);
  }

  function handleSelectProduct(product: Product) {
    const alreadySelected = selectedProducts.find((p) => p.id === product.id);
    if (alreadySelected) {
      // Remove from selection
      const updated = selectedProducts.filter((p) => p.id !== product.id);
      setSelectedProducts(updated);
    } else {
      // Add to selection
      const updated = [...selectedProducts, product];
      setSelectedProducts(updated);
    }
    // Recalculate total and description
    const total = (alreadySelected
      ? selectedProducts.filter((p) => p.id !== product.id)
      : [...selectedProducts, product]
    ).reduce((sum, p) => sum + p.price, 0);
    setCents(total);
    setProductQuery('');
    setProductResults([]);
    setValueError('');
  }

  function handleRemoveProduct(productId: string) {
    const updated = selectedProducts.filter((p) => p.id !== productId);
    setSelectedProducts(updated);
    const total = updated.reduce((sum, p) => sum + p.price, 0);
    setCents(total);
  }

  // ── Step 1 handlers ──

  function handleAmountChange(text: string) {
    const c = parseCents(text);
    setCents(c);
    if (c > 0) setValueError('');
  }

  function handleStep1Next() {
    if (useProductMode && selectedProducts.length === 0) {
      setValueError('Selecione pelo menos um produto do catálogo');
      return;
    }
    if (cents <= 0) {
      setValueError('Informe um valor maior que R$ 0,00');
      return;
    }
    // Auto-generate description from selected products
    if (useProductMode && selectedProducts.length > 0) {
      setDescription(selectedProducts.map((p) => p.name).join(', '));
    }
    setStep('client');
  }

  // ── Step 2 handlers ──

  function handleQueryChange(text: string) {
    setQuery(text);
    setSelectedClient(null);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await searchClients(text.trim());
        setResults(data);
      } catch {
        // non-critical
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }

  function handleSelectClient(client: Client) {
    setSelectedClient(client);
    setQuery(client.name);
    setResults([]);
    setShowNewForm(false);
  }

  function handleShowNewForm() {
    setSelectedClient(null);
    setResults([]);
    setShowNewForm(true);
    setNewClient({ name: query, whatsapp: '' });
  }

  function validateNewClient(): boolean {
    const errs: Partial<NewClientForm> = {};
    if (!newClient.name.trim()) errs.name = 'Informe o nome';
    setNewClientErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleCreateAndSelect() {
    if (!validateNewClient()) return;
    setClientLoading(true);
    try {
      const created = await createClient({
        name: newClient.name.trim(),
        whatsapp: newClient.whatsapp.trim() || null,
        email: null,
      });
      setSelectedClient(created);
      setQuery(created.name);
      setShowNewForm(false);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível criar o cliente.');
    } finally {
      setClientLoading(false);
    }
  }

  async function handleStep2Next() {
    if (!selectedClient) {
      Alert.alert('Atenção', 'Selecione ou cadastre um cliente para continuar.');
      return;
    }

    const pixKey = profile?.pix_key ?? '';
    const merchantName = profile?.company_name ?? 'Empresa';
    const hasMpToken = profile?.mp_access_token && profile.mp_access_token.trim().length > 0;

    setSaving(true);
    try {
      // Create transaction first
      const tx = await createTransaction({
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        amount: cents,
        description: description || null,
        pix_key: pixKey || null,
        pix_copy_paste: null,
        pix_qr_code: null,
      });

      let finalTx = tx;

      // If user has MP configured, create payment link via Edge Function
      if (hasMpToken) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const response = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-link`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  transaction_id: tx.id,
                  amount: cents,
                  description: description || `Cobrança - ${selectedClient.name}`,
                  client_name: selectedClient.name,
                  payer_email: selectedClient.email || undefined,
                }),
              }
            );

            const result = await response.json();

            if (response.ok && result.payment_url) {
              // Update transaction with payment URL
              finalTx = { ...tx, payment_url: result.payment_url };
            } else {
              // Fallback to PIX mock if MP fails
              console.warn('MP integration failed, using PIX mock:', result.error);
              const mock = mockPixPayload({
                pixKey: pixKey || 'cobranca@app.com',
                amount: cents,
                description: description || 'Cobrança',
                merchantName,
              });
              finalTx = { ...tx, pix_copy_paste: mock.pix_copy_paste, pix_qr_code: mock.pix_qr_code };
            }
          }
        } catch (mpError) {
          // Fallback to PIX mock
          console.warn('MP integration error:', mpError);
          const mock = mockPixPayload({
            pixKey: pixKey || 'cobranca@app.com',
            amount: cents,
            description: description || 'Cobrança',
            merchantName,
          });
          finalTx = { ...tx, pix_copy_paste: mock.pix_copy_paste, pix_qr_code: mock.pix_qr_code };
        }
      } else {
        // No MP token, use PIX mock
        const mock = mockPixPayload({
          pixKey: pixKey || 'cobranca@app.com',
          amount: cents,
          description: description || 'Cobrança',
          merchantName,
        });
        finalTx = { ...tx, pix_copy_paste: mock.pix_copy_paste, pix_qr_code: mock.pix_qr_code };
      }

      setTransaction(finalTx);
      setStep('success');
      // Refresh dashboard in background
      refresh();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err.message ?? 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // ── Step 3 handlers ──

  function handleShareWhatsApp() {
    if (!selectedClient?.whatsapp || !transaction) return;
    const number = formatWhatsApp(selectedClient.whatsapp).replace('+', '');
    const amount = formatCurrency(transaction.amount);
    const companyName = profile?.company_name ?? 'Empresa';
    const desc = transaction.description ? `*${transaction.description}*\n` : '';

    let msg: string;

    if (transaction.payment_url) {
      // MP payment link - send checkout URL
      msg = encodeURIComponent(
        `Olá, ${selectedClient.name}! 👋\n\n` +
        `Você recebeu uma cobrança de *${companyName}*:\n\n` +
        `${desc}` +
        `💰 *Valor:* ${amount}\n\n` +
        `🔗 *Link para pagamento:*\n${transaction.payment_url}\n\n` +
        `Aceita PIX e cartão de crédito!`,
      );
    } else if (transaction.pix_copy_paste) {
      // PIX mock
      msg = encodeURIComponent(
        `Olá, ${selectedClient.name}! 👋\n\n` +
        `Segue a cobrança gerada por *${companyName}*:\n\n` +
        `${desc}` +
        `💰 *Valor:* ${amount}\n\n` +
        `📋 *Chave pix:*\n\`${transaction.pix_copy_paste}\`\n\n` +
        `Qualquer dúvida, é só chamar!`,
      );
    } else {
      // No payment method
      msg = encodeURIComponent(
        `Olá, ${selectedClient.name}! 👋\n\n` +
        `Você recebeu uma cobrança de *${companyName}*:\n\n` +
        `${desc}` +
        `💰 *Valor:* ${amount}\n\n` +
        `Qualquer dúvida, é só chamar!`,
      );
    }

    Linking.openURL(`https://wa.me/${number}?text=${msg}`);
  }

  function handleNewCharge() {
    setCents(0);
    setDescription('');
    setQuery('');
    setSelectedClient(null);
    setShowNewForm(false);
    setNewClient({ name: '', whatsapp: '' });
    setTransaction(null);
    setStep('value');
    setUseProductMode(false);
    setSelectedProducts([]);
    setProductQuery('');
    setProductResults([]);
  }

  function handleBack() {
    if (step === 'client') { setStep('value'); return; }
    router.back();
  }

  // ── Render ──

  const stepIndex = step === 'value' ? 0 : step === 'client' ? 1 : 2;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Header */}
        {step !== 'success' && (
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleBack}>
              <ChevronLeft size={22} color="#374151" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Nova Cobrança</Text>
              <StepDots current={stepIndex} />
            </View>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 1: Valor ── */}
        {step === 'value' && (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>Qual o valor da cobrança?</Text>
            <Text style={styles.stepSubtitle}>Escolha um produto do catálogo ou insira manualmente</Text>

            {/* Product toggle button */}
            <TouchableOpacity
              style={[styles.toggleBtn, useProductMode && styles.toggleBtnActive]}
              onPress={handleToggleProductMode}
              activeOpacity={0.8}
            >
              <Package size={18} color={useProductMode ? '#FFFFFF' : '#0066FF'} />
              <Text style={[styles.toggleBtnText, useProductMode && styles.toggleBtnTextActive]}>
                {useProductMode ? 'Produto selecionado' : 'Escolher do Catálogo'}
              </Text>
            </TouchableOpacity>

            {/* Product search mode */}
            {useProductMode && (
              <View style={{ marginTop: 20 }}>
                {/* Selected products list */}
                {selectedProducts.length > 0 && (
                  <View style={styles.selectedProductsList}>
                    <Text style={styles.selectedProductsTitle}>
                      Produtos selecionados ({selectedProducts.length})
                    </Text>
                    {selectedProducts.map((product) => (
                      <View key={product.id} style={styles.selectedProductItem}>
                        <View style={styles.productChipIcon}>
                          <Package size={14} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productChipName}>{product.name}</Text>
                          <Text style={styles.productChipPrice}>{formatCurrency(product.price)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveProduct(product.id)}>
                          <X size={16} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>{formatCurrency(cents)}</Text>
                    </View>
                  </View>
                )}

                {/* Search bar */}
                <View style={styles.productSearchBar}>
                  <Search size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.productSearchInput}
                    placeholder="Buscar produto..."
                    placeholderTextColor="#9CA3AF"
                    value={productQuery}
                    onChangeText={handleProductQueryChange}
                  />
                  {productSearchLoading && <ActivityIndicator size="small" color="#0066FF" />}
                </View>

                {/* Search results */}
                {productResults.length > 0 && (
                  <View style={styles.productResultsList}>
                    {productResults.slice(0, 5).map((product) => {
                      const isSelected = selectedProducts.some((p) => p.id === product.id);
                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={[styles.productResultRow, isSelected && styles.productResultRowSelected]}
                          onPress={() => handleSelectProduct(product)}
                        >
                          <View style={styles.productResultIcon}>
                            <Package size={16} color={isSelected ? '#FFFFFF' : '#0066FF'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.productResultName}>{product.name}</Text>
                            <Text style={styles.productResultPrice}>{formatCurrency(product.price)}</Text>
                          </View>
                          {isSelected && <Check size={18} color="#FFFFFF" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Manual input mode */}
            {!useProductMode && (
              <>
                <View style={styles.amountBox}>
                  <Text style={styles.currencySymbol}>R$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={formatCentsInput(cents)}
                    onChangeText={handleAmountChange}
                    keyboardType="numeric"
                    placeholder="0,00"
                    placeholderTextColor="#D1D5DB"
                    returnKeyType="next"
                  />
                </View>
                {valueError ? <Text style={styles.fieldError}>{valueError}</Text> : null}

                <View style={{ marginTop: 24 }}>
                  <Input
                    label="Descrição do serviço (opcional)"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Ex: Conserto elétrico, Corte de cabelo..."
                    returnKeyType="done"
                    onSubmitEditing={handleStep1Next}
                  />
                </View>
              </>
            )}

            <Button
              label="Escolher cliente →"
              onPress={handleStep1Next}
              style={styles.ctaButton}
            />
          </ScrollView>
        )}

        {/* ── STEP 2: Cliente ── */}
        {step === 'client' && (
          <View style={styles.flex}>
            <View style={styles.content}>
              <Text style={styles.stepTitle}>Para quem é a cobrança?</Text>
              <Text style={styles.stepSubtitle}>Busque um cliente ou cadastre um novo</Text>

              {/* Selected chip */}
              {selectedClient && (
                <View style={styles.selectedChip}>
                  <View style={styles.chipAvatar}>
                    <Text style={styles.chipAvatarText}>
                      {selectedClient.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                    </Text>
                  </View>
                  <Text style={styles.chipName} numberOfLines={1}>{selectedClient.name}</Text>
                  <TouchableOpacity onPress={() => { setSelectedClient(null); setQuery(''); }}>
                    <X size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Search field */}
              {!selectedClient && (
                <View style={styles.searchBar}>
                  <Search size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por nome..."
                    placeholderTextColor="#9CA3AF"
                    value={query}
                    onChangeText={handleQueryChange}
                    autoFocus
                    returnKeyType="search"
                  />
                  {searchLoading && <ActivityIndicator size="small" color="#9CA3AF" />}
                </View>
              )}

              {/* Results list */}
              {!selectedClient && results.length > 0 && (
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id}
                  style={styles.resultsList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.resultRow}
                      onPress={() => handleSelectClient(item)}
                    >
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultAvatarText}>
                          {item.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        {item.whatsapp ? (
                          <Text style={styles.resultSub}>{item.whatsapp}</Text>
                        ) : null}
                      </View>
                      <Check size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
                />
              )}

              {/* New client shortcut */}
              {!selectedClient && !showNewForm && (
                <TouchableOpacity style={styles.newClientBtn} onPress={handleShowNewForm}>
                  <UserPlus size={18} color="#0066FF" />
                  <Text style={styles.newClientBtnText}>
                    {query ? `Cadastrar "${query}" como novo cliente` : 'Cadastrar novo cliente'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* New client inline form */}
              {showNewForm && !selectedClient && (
                <View style={styles.newClientForm}>
                  <Text style={styles.newClientFormTitle}>Novo cliente</Text>
                  <Input
                    label="Nome *"
                    value={newClient.name}
                    onChangeText={(v) => setNewClient((p) => ({ ...p, name: v }))}
                    placeholder="Nome completo"
                    error={newClientErrors.name}
                    returnKeyType="next"
                  />
                  <Input
                    label="WhatsApp (opcional)"
                    value={newClient.whatsapp}
                    onChangeText={(v) => setNewClient((p) => ({ ...p, whatsapp: v }))}
                    placeholder="(11) 99999-9999"
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleCreateAndSelect}
                  />
                  <View style={styles.newClientActions}>
                    <Button
                      label="Cancelar"
                      onPress={() => setShowNewForm(false)}
                      variant="secondary"
                      style={styles.flexHalf}
                    />
                    <Button
                      label="Salvar"
                      onPress={handleCreateAndSelect}
                      loading={clientLoading}
                      style={styles.flexHalf}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Bottom CTA */}
            <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.summaryCta}>
                <Text style={styles.summaryLabel}>Valor da cobrança</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(cents)}</Text>
              </View>
              <Button
                label="Gerar cobrança"
                onPress={handleStep2Next}
                loading={saving}
                disabled={!selectedClient}
                style={styles.ctaFull}
              />
            </View>
          </View>
        )}

        {/* ── STEP 3: Sucesso ── */}
        {step === 'success' && transaction && (
          <ScrollView
            contentContainerStyle={[styles.successContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Success badge */}
            <View style={styles.successBadge}>
              <Check size={28} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.successTitle}>Cobrança gerada!</Text>
            <Text style={styles.successSubtitle}>
              Compartilhe com {selectedClient?.name} pelo WhatsApp
            </Text>

            {/* Amount */}
            <Text style={styles.successAmount}>{formatCurrency(transaction.amount)}</Text>
            {transaction.description ? (
              <Text style={styles.successDesc}>{transaction.description}</Text>
            ) : null}

            {/* MP Payment Link */}
            {transaction.payment_url ? (
              <View style={styles.mpLinkBox}>
                <View style={styles.mpLinkHeader}>
                  <CreditCard size={18} color="#0066FF" />
                  <Text style={styles.mpLinkTitle}>Link de Pagamento</Text>
                </View>
                <Text style={styles.mpLinkDesc}>
                  O cliente pode pagar com PIX ou cartão de crédito
                </Text>
                <TouchableOpacity
                  style={styles.mpLinkCopyBtn}
                  onPress={() => {
                    // Copy to clipboard would require expo-clipboard
                    Alert.alert('Link copiado!', transaction.payment_url || '');
                  }}
                >
                  <LinkIcon size={16} color="#FFFFFF" />
                  <Text style={styles.mpLinkCopyText}>Copiar link</Text>
                </TouchableOpacity>
                <Text style={styles.mpLinkUrl} selectable numberOfLines={2}>
                  {transaction.payment_url}
                </Text>
              </View>
            ) : null}

            {/* QR Code (fallback) */}
            {transaction.pix_qr_code ? (
              <View style={styles.qrBox}>
                <Text style={styles.qrLabel}>PIX — Aponte a câmera para pagar</Text>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={transaction.pix_qr_code}
                    size={200}
                    color="#111827"
                    backgroundColor="#FFFFFF"
                  />
                </View>
              </View>
            ) : null}

            {/* Copia e cola */}
            {transaction.pix_copy_paste ? (
              <View style={styles.copyBox}>
                <Text style={styles.copyLabel}>Chave pix cadastrada</Text>
                <Text style={styles.copyValue} selectable numberOfLines={3}>
                  {transaction.pix_copy_paste}
                </Text>
              </View>
            ) : null}

            {/* WhatsApp CTA — only shown if client has whatsapp */}
            {selectedClient?.whatsapp ? (
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={handleShareWhatsApp}
                activeOpacity={0.85}
              >
                <Text style={styles.whatsappBtnText}>
                  Compartilhar no WhatsApp
                </Text>
              </TouchableOpacity>
            ) : null}

            <Button
              label="Nova cobrança"
              onPress={handleNewCharge}
              variant="secondary"
              style={styles.newChargeBtn}
            />

            <Button
              label="Voltar ao início"
              onPress={() => router.replace('/(tabs)')}
              variant="ghost"
            />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 6 },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },

  // Shared content
  content: { paddingHorizontal: 24, paddingTop: 24, gap: 0 },
  stepTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 28,
  },
  ctaButton: { marginTop: 32 },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginTop: 6,
  },

  // Amount input
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#6B7280',
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    padding: 0,
  },

  // Client search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    backgroundColor: '#FAFBFF',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  resultsList: {
    maxHeight: 220,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 10,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#0066FF',
  },
  resultName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  resultSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  newClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#EFF4FF',
    borderRadius: 14,
    marginTop: 8,
  },
  newClientBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0066FF',
    flexShrink: 1,
  },
  newClientForm: {
    gap: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  newClientFormTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  newClientActions: { flexDirection: 'row', gap: 10 },
  flexHalf: { flex: 1 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF4FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 16,
  },
  chipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  chipName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },

  // Product selection
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0066FF',
    backgroundColor: '#FFFFFF',
  },
  toggleBtnActive: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  toggleBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0066FF',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  productSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    backgroundColor: '#FAFBFF',
  },
  productSearchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  productResultsList: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    padding: 8,
    gap: 4,
  },
  productResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    gap: 10,
  },
  productResultRowSelected: {
    backgroundColor: '#0066FF',
  },
  productResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productResultName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  productResultPrice: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#059669',
  },
  selectedProductChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF4FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  selectedProductsList: {
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  selectedProductsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  selectedProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0066FF',
  },
  productChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productChipName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  productChipPrice: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },

  // Bottom action bar (step 2)
  bottomAction: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  summaryCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  summaryAmount: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  ctaFull: { width: '100%' },

  // Success screen
  successContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 0,
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  successAmount: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  successDesc: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 28,
  },
  qrBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  qrLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  copyBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 24,
  },
  copyLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  copyValue: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 18,
  },
  whatsappBtn: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  whatsappBtnText: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  newChargeBtn: { width: '100%', marginBottom: 8 },

  // MP Payment Link
  mpLinkBox: {
    width: '100%',
    backgroundColor: '#EFF4FF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  mpLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mpLinkTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0066FF',
  },
  mpLinkDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  mpLinkCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0066FF',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  mpLinkCopyText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  mpLinkUrl: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
});
