import { supabase } from './supabase';
import { Product } from '@/src/types';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createProduct(
  fields: Pick<Product, 'name' | 'price' | 'quantity'>,
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(fields)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(
  id: string,
  fields: Partial<Pick<Product, 'name' | 'price' | 'quantity'>>,
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
