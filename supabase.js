import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
export const supabase = url && key ? createClient(url, key) : null;
export const hasSupabaseConfig = Boolean(supabase);

export function requireSupabase() {
  if (!supabase) throw new Error('The product catalog is being configured. Please check back soon.');
  return supabase;
}

export function getPublicImageUrl(path) {
  if (!path) return '';
  const client = requireSupabase();
  return client.storage.from('catalog-products').getPublicUrl(path).data.publicUrl;
}
