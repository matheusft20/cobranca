import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search, Package, Pencil, Trash2, X, Check } from 'lucide-react-native';
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '@/src/services';
import { Product } from '@/src/types';
import { formatCurrency } from '@/src/utils/format';
import { Button } from '@/src/components/Button';

type Mode = 'list' | 'form';

interface ProductForm {
  name: string;
  price: string;
  quantity: string;
}

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>({ name: '', price: '', quantity: '1' });
  const [formErrors, setFormErrors] = useState<Partial<ProductForm>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
      setFiltered(data);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(products);
    } else {
      const q = query.toLowerCase();
      setFiltered(products.filter((p) => p.name.toLowerCase().includes(q)));
    }
  }, [query, products]);

  function parsePrice(text: string): string {
    const digits = text.replace(/\D/g, '');
    if (!digits) return '';
    const cents = parseInt(digits, 10);
    return (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function priceToCents(text: string): number {
    const digits = text.replace(/\D/g, '');
    return parseInt(digits || '0', 10);
  }

  function handleOpenCreate() {
    setEditingProduct(null);
    setForm({ name: '', price: '', quantity: '1' });
    setFormErrors({});
    setMode('form');
  }

  function handleOpenEdit(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      price: formatCurrency(product.price).replace('R$', '').trim(),
      quantity: String(product.quantity),
    });
    setFormErrors({});
    setMode('form');
  }

  function validateForm(): boolean {
    const errs: Partial<ProductForm> = {};
    if (!form.name.trim()) errs.name = 'Informe o nome';
    if (priceToCents(form.price) <= 0) errs.price = 'Informe o valor';
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty < 0) errs.quantity = 'Quantidade inválida';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const cents = priceToCents(form.price);
      const quantity = parseInt(form.quantity, 10) || 1;

      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, {
          name: form.name.trim(),
          price: cents,
          quantity,
        });
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createProduct({
          name: form.name.trim(),
          price: cents,
          quantity,
        });
        setProducts((prev) => [...prev, created]);
      }
      setMode('list');
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(product: Product) {
    Alert.alert(
      'Excluir produto',
      `Deseja realmente excluir "${product.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              setProducts((prev) => prev.filter((p) => p.id !== product.id));
            } catch (err: any) {
              Alert.alert('Erro', err.message ?? 'Não foi possível excluir o produto.');
            }
          },
        },
      ],
    );
  }

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.7}
      onPress={() => handleOpenEdit(item)}
    >
      <View style={styles.productIcon}>
        <Package size={20} color="#0066FF" />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
          <Text style={styles.productQty}>Qtd: {item.quantity}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => handleDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={18} color="#EF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {mode === 'list' && (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Produtos</Text>
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate}>
              <Plus size={22} color="#0066FF" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Search size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar produto..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <ActivityIndicator color="#0066FF" style={{ marginTop: 48 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: insets.bottom + 16 },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Package size={32} color="#9CA3AF" />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {query ? 'Nenhum resultado' : 'Nenhum produto ainda'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {query
                      ? `Sem produtos com "${query}"`
                      : 'Cadastre produtos para usar nas cobranças'}
                  </Text>
                  {!query && (
                    <TouchableOpacity style={styles.emptyBtn} onPress={handleOpenCreate}>
                      <Plus size={18} color="#FFFFFF" />
                      <Text style={styles.emptyBtnText}>Adicionar produto</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </>
      )}

      {mode === 'form' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.formScreen}>
            <View style={styles.formHeader}>
              <TouchableOpacity style={styles.formBack} onPress={() => setMode('list')}>
                <X size={22} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.formTitle}>
                {editingProduct ? 'Editar produto' : 'Novo produto'}
              </Text>
              <View style={styles.formBack} />
            </View>

            <View style={styles.formContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.name && styles.formInputError]}
                  placeholder="Ex: Corte de cabelo, Consultoria..."
                  placeholderTextColor="#9CA3AF"
                  value={form.name}
                  onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                />
                {formErrors.name && <Text style={styles.formError}>{formErrors.name}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Valor (R$) *</Text>
                <View style={[styles.priceInputWrap, formErrors.price && styles.formInputError]}>
                  <Text style={styles.pricePrefix}>R$</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0,00"
                    placeholderTextColor="#9CA3AF"
                    value={form.price}
                    keyboardType="numeric"
                    onChangeText={(v) => setForm((p) => ({ ...p, price: parsePrice(v) }))}
                  />
                </View>
                {formErrors.price && <Text style={styles.formError}>{formErrors.price}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quantidade</Text>
                <TextInput
                  style={[styles.formInput, formErrors.quantity && styles.formInputError]}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  value={form.quantity}
                  keyboardType="numeric"
                  onChangeText={(v) => setForm((p) => ({ ...p, quantity: v }))}
                />
                {formErrors.quantity && <Text style={styles.formError}>{formErrors.quantity}</Text>}
              </View>
            </View>

            <View style={[styles.formActions, { paddingBottom: insets.bottom + 16 }]}>
              <Button
                label="Cancelar"
                onPress={() => setMode('list')}
                variant="secondary"
                style={styles.flexHalf}
              />
              <Button
                label={editingProduct ? 'Salvar' : 'Cadastrar'}
                onPress={handleSave}
                loading={saving}
                style={styles.flexHalf}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F5F7FB' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1, gap: 4 },
  productName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  productQty: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  actionBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  separator: { height: 8 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0066FF',
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },

  // Form screen
  formScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  formBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  formContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 20,
  },
  formGroup: { gap: 8 },
  formLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  formInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    backgroundColor: '#FAFBFF',
  },
  formInputError: {
    borderColor: '#EF4444',
  },
  formError: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FAFBFF',
    gap: 8,
  },
  pricePrefix: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  priceInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  flexHalf: { flex: 1 },
});
