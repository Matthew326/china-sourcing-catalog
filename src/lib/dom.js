export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const slugify = (value = '') => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
export const imageUrl = (supabase, path) => path ? supabase.storage.from('catalog-products').getPublicUrl(path).data.publicUrl : '';
export const imageMarkup = (supabase, path, alt, extra = '') => {
  const url = imageUrl(supabase, path);
  return url ? `<img class="${extra}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="image-placeholder" hidden aria-hidden="true">Image unavailable</div>` : `<div class="image-placeholder" aria-label="No product image">Image coming soon</div>`;
};
export const toast = (message, type = 'info') => {
  let node = document.querySelector('#toast');
  if (!node) { node = document.createElement('div'); node.id = 'toast'; node.className = 'toast'; node.setAttribute('role', 'status'); document.body.append(node); }
  node.textContent = message; node.dataset.type = type; node.classList.add('visible');
  clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => node.classList.remove('visible'), 4200);
};
