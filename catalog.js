import { requireSupabase } from './supabase.js';

const PRODUCT_SELECT = '*, categories(id,name,slug), product_images(id,storage_path,alt_text,sort_order)';

export async function getCategories({ activeOnly = true } = {}) {
  const db = requireSupabase();
  let query = db.from('categories').select('*').order('sort_order').order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getFeaturedProducts(limit = 6) {
  const db = requireSupabase();
  const { data, error } = await db.from('products').select(PRODUCT_SELECT)
    .eq('is_published', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getProducts({ categorySlug = '', search = '', page = 1, pageSize = 12 } = {}) {
  const db = requireSupabase();
  const from = (page - 1) * pageSize;
  let query = db.from('products').select(PRODUCT_SELECT, { count: 'exact' })
    .eq('is_published', true).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (categorySlug) {
    const { data: category, error: categoryError } = await db.from('categories').select('id').eq('slug', categorySlug).eq('is_active', true).maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) return { products: [], count: 0 };
    query = query.eq('category_id', category.id);
  }
  const term = search.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,short_description.ilike.%${term}%,description.ilike.%${term}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  return { products: data ?? [], count: count ?? 0 };
}

export async function getProduct(slug) {
  const db = requireSupabase();
  const { data, error } = await db.from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This product could not be found.');
  if (data.product_images) data.product_images.sort((a, b) => a.sort_order - b.sort_order);
  return data;
}
