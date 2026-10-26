import './style.css';
import { requireSupabase } from './lib/supabase.js';
import { escapeHtml, imageMarkup, slugify, toast } from './lib/dom.js';

const app = document.querySelector('#app');
const PAGE_SIZE = 12;
const initialCategories = [
  ['jewelry-accessories','Jewelry & Accessories','Jewelry, watches and fashion accessories','rose'],
  ['apparel-footwear-bags','Apparel, Footwear & Bags','Clothing, shoes, bags and textiles','sand'],
  ['electronics-accessories','Electronics & Accessories','Consumer electronics and components','blue'],
  ['machinery-industrial-equipment','Machinery & Industrial Equipment','Industrial machinery, tools and equipment','mint'],
  ['construction-building-materials','Construction & Building Materials','Building materials, hardware and fittings','gold'],
  ['energy-storage-new-energy','Energy Storage & New Energy','Batteries, storage systems and solar equipment','green'],
  ['furniture-home-furnishings','Furniture & Home Furnishings','Furniture, lighting and home décor','lilac'],
];

function header() {
  return `<header class="site-header"><a class="brand" href="#/" aria-label="China Sourcing Catalog home"><span class="brand-symbol">C</span><span>CHINA SOURCING<small>CATALOG</small></span></a><nav class="desktop-nav" aria-label="Main navigation"><a href="#/categories">Categories</a><a href="#/products">Products</a><a href="#/about">About</a></nav><a class="header-cta" href="#/inquiry">Contact Us <span aria-hidden="true">↗</span></a></header>`;
}
function footer() {
  return `<footer class="site-footer"><a class="brand" href="#/"><span class="brand-symbol">C</span><span>CHINA SOURCING<small>CATALOG</small></span></a><p>Discover Products. Connect with Suppliers.</p><span>© ${new Date().getFullYear()} China Sourcing Catalog</span></footer>`;
}
function shell(body) { app.innerHTML = header() + `<main>${body}</main>` + footer(); }
function categoryCard(category, index = 0) {
  const tone = ['rose','sand','blue','mint','gold','green','lilac'][index % 7];
  return `<a class="category-card" href="#/products?category=${encodeURIComponent(category.slug)}"><div class="category-art ${tone}"><span class="category-number">${String(index + 1).padStart(2,'0')}</span><span class="category-monogram">${escapeHtml(category.name.charAt(0))}</span><span class="art-orbit"></span></div><div class="category-copy"><div><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description || '')}</p></div><span class="arrow" aria-hidden="true">↗</span></div></a>`;
}
function productCard(product, index = 0) {
  const image = product.product_images?.[0];
  const title = escapeHtml(product.name);
  return `<article class="product-card"><a class="product-image" href="#/product/${encodeURIComponent(product.slug)}">${imageMarkup(requireSupabase(), image?.storage_path, image?.alt_text || product.name, 'product-photo')}<span class="product-overlay">View Details ↗</span></a><div class="product-card-meta"><span>${escapeHtml(product.categories?.name || 'Catalog Product')}</span><span>${escapeHtml(product.sku)}</span></div><h3><a href="#/product/${encodeURIComponent(product.slug)}">${title}</a></h3><p>${escapeHtml(product.short_description || '')}</p><div class="product-card-actions"><a href="#/product/${encodeURIComponent(product.slug)}">View Details</a><a href="#/inquiry?product=${encodeURIComponent(product.id)}">Inquiry <span>↗</span></a></div></article>`;
}
function loading() { return `<div class="loading-state"><span class="spinner"></span><p>Loading the catalog…</p></div>`; }
function catalogError(error) { return `<div class="empty-products"><div class="empty-icon">✳</div><h3>Catalog setup in progress.</h3><p>${escapeHtml(error?.message || 'Please check back soon.')}</p></div>`; }

async function home() {
  shell(`<section class="hero"><div class="hero-content"><p class="eyebrow"><span></span> CHINA SOURCING CATALOG</p><h1>Discover Products.<br /><em>Connect with Suppliers.</em></h1><p class="hero-description">Discover products across multiple categories and contact us for sourcing inquiries.</p><form class="search" id="home-search" role="search"><span class="search-icon" aria-hidden="true">⌕</span><input name="q" type="search" placeholder="Search products, categories or keywords" aria-label="Search products, categories or keywords" /><button type="submit">Search <span aria-hidden="true">→</span></button></form><p class="search-note">Browse product categories or search the catalog.</p></div><div class="hero-visual" aria-hidden="true"><div class="visual-backdrop"></div><div class="visual-label">GLOBAL SOURCING<br />MADE CLEAR</div><div class="visual-card visual-card-one"><span class="visual-shape shape-one"></span><b>PRODUCT<br />DISCOVERY</b><small>01 / 03</small></div><div class="visual-card visual-card-two"><span class="visual-shape shape-two"></span><b>SUPPLIER<br />CONNECTIONS</b><small>02 / 03</small></div><div class="visual-card visual-card-three"><span class="visual-shape shape-three"></span><b>BETTER<br />SOURCING</b><small>03 / 03</small></div><div class="visual-stamp">MADE TO<br />CONNECT <span>✳</span></div></div><div class="hero-footer"><span>PRODUCTS FROM CHINA</span><span>BUILT FOR GLOBAL BUSINESS</span><span>SCROLL TO EXPLORE ↓</span></div></section><section class="section categories-section" id="categories"><div class="section-heading"><div><p class="eyebrow">EXPLORE THE CATALOG</p><h2>Find your next<br /><em>great supplier.</em></h2></div><p class="section-intro">A growing directory of products from China, organized to make your sourcing journey easier.</p></div><div class="category-grid" id="home-categories">${loading()}</div><div class="section-bottom"><span>MORE CATEGORIES WILL BE ADDED</span><a href="#/inquiry">Need help sourcing? <b>Let’s talk ↗</b></a></div></section><section class="products-section" id="products"><div class="products-inner"><div class="section-heading"><div><p class="eyebrow">CURATED FOR YOU</p><h2>Featured <em>products.</em></h2></div><a class="text-link" href="#/products">Browse all products <span>↗</span></a></div><div class="product-grid" id="featured-products">${loading()}</div></div></section><section class="about-section" id="about"><div><p class="eyebrow">CHINA SOURCING CATALOG</p><h2>Good sourcing<br />starts with a <em>conversation.</em></h2></div><p>Share what you’re looking for. We’ll help you explore products and connect with the right suppliers.</p></section><section class="contact-section" id="inquiry"><div class="contact-copy"><p class="eyebrow">LET’S GET STARTED</p><h2>Have a product<br />in <em>mind?</em></h2><p>Tell us what you’re looking for and we’ll help you get started.</p></div><a class="contact-link" href="#/inquiry">Start an inquiry <span>↗</span></a></section>`);
  document.querySelector('#home-search').addEventListener('submit', (event) => { event.preventDefault(); const term = new FormData(event.currentTarget).get('q')?.toString().trim(); location.hash = `#/products${term ? `?q=${encodeURIComponent(term)}` : ''}`; });
  try {
    const { getCategories, getFeaturedProducts } = await import('./lib/catalog.js');
    const [categories, products] = await Promise.all([getCategories(), getFeaturedProducts()]);
    document.querySelector('#home-categories').innerHTML = categories.length ? categories.map(categoryCard).join('') : `<p class="empty-inline">Product categories will appear here soon.</p>`;
    document.querySelector('#featured-products').innerHTML = products.length ? products.map(productCard).join('') : `<div class="empty-products"><div class="empty-icon">✳</div><h3>New finds are on the way.</h3><p>Featured products will appear here once the catalog is ready.</p><a class="button-dark" href="#/inquiry">Send a sourcing inquiry <span>→</span></a></div>`;
  } catch (error) {
    document.querySelector('#home-categories').innerHTML = initialCategories.map(([slug,name,description], index) => categoryCard({ slug, name, description }, index)).join('');
    document.querySelector('#featured-products').innerHTML = catalogError(error);
  }
}

async function productsPage(params) {
  const query = new URLSearchParams(params);
  const categorySlug = query.get('category') || '';
  const search = query.get('q') || '';
  const page = Math.max(1, Number(query.get('page')) || 1);
  shell(`<section class="catalog-page"><div class="page-heading"><p class="eyebrow">PRODUCT DIRECTORY</p><h1>Explore <em>products.</em></h1><p>Browse the catalog and contact us for product details or sourcing support.</p></div><form class="search catalog-search" id="catalog-search"><span class="search-icon" aria-hidden="true">⌕</span><input name="q" type="search" value="${escapeHtml(search)}" placeholder="Search products, SKU or description" aria-label="Search products, SKU or description" /><button type="submit">Search <span>→</span></button></form><div class="catalog-toolbar"><div id="category-filters">${loading()}</div><span id="results-count"></span></div><div class="product-grid" id="product-list">${loading()}</div><nav class="pagination" id="pagination" aria-label="Product pages"></nav></section>`);
  document.querySelector('#catalog-search').addEventListener('submit', (event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get('q')?.toString().trim() || ''; const next = new URLSearchParams(); if (categorySlug) next.set('category', categorySlug); if (value) next.set('q', value); location.hash = `#/products${next.size ? `?${next}` : ''}`; });
  try {
    const { getCategories, getProducts } = await import('./lib/catalog.js');
    const [categories, result] = await Promise.all([getCategories(), getProducts({ categorySlug, search, page, pageSize: PAGE_SIZE })]);
    document.querySelector('#category-filters').innerHTML = `<a class="filter-chip ${categorySlug ? '' : 'active'}" href="#/products">All Products</a>${categories.map((category) => `<a class="filter-chip ${category.slug === categorySlug ? 'active' : ''}" href="#/products?category=${encodeURIComponent(category.slug)}${search ? `&q=${encodeURIComponent(search)}` : ''}">${escapeHtml(category.name)}</a>`).join('')}`;
    document.querySelector('#results-count').textContent = `${result.count} ${result.count === 1 ? 'product' : 'products'}`;
    document.querySelector('#product-list').innerHTML = result.products.length ? result.products.map(productCard).join('') : `<div class="empty-products"><div class="empty-icon">⌕</div><h3>No products found.</h3><p>Try another search or browse all product categories.</p><a class="button-dark" href="#/products">Clear filters <span>→</span></a></div>`;
    const pages = Math.ceil(result.count / PAGE_SIZE);
    document.querySelector('#pagination').innerHTML = pages > 1 ? `${page > 1 ? `<a href="#/products?${new URLSearchParams({...Object.fromEntries(query),page:String(page - 1)})}">← Previous</a>` : '<span></span>'}<span>Page ${page} of ${pages}</span>${page < pages ? `<a href="#/products?${new URLSearchParams({...Object.fromEntries(query),page:String(page + 1)})}">Next →</a>` : '<span></span>'}` : '';
  } catch (error) { document.querySelector('#product-list').innerHTML = catalogError(error); document.querySelector('#category-filters').innerHTML = initialCategories.map(([slug,name]) => `<a class="filter-chip" href="#/products?category=${slug}">${escapeHtml(name)}</a>`).join(''); }
}

async function productPage(slug) {
  shell(`<section class="detail-page">${loading()}</section>`);
  try {
    const { getProduct } = await import('./lib/catalog.js');
    const product = await getProduct(slug);
    const images = product.product_images || [];
    const mainImage = images[0];
    const specs = Object.entries(product.specifications || {}).filter(([,value]) => value !== '' && value != null).map(([key,value]) => `<div class="spec-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}</dd></div>`).join('');
    const details = [['Material',product.materials],['Dimensions',product.dimensions],['Colors',product.colors?.join(', ')],['Models',product.models?.join(', ')],['Minimum Order Quantity',product.minimum_order_quantity],['OEM',product.oem_available == null ? '' : product.oem_available ? 'Available' : 'Not available'],['ODM',product.odm_available == null ? '' : product.odm_available ? 'Available' : 'Not available']].filter(([,value]) => value !== '' && value != null).map(([key,value]) => `<div class="spec-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
    document.querySelector('.detail-page').innerHTML = `<nav class="breadcrumbs"><a href="#/">Home</a><span>/</span><a href="#/products">Products</a><span>/</span><span>${escapeHtml(product.name)}</span></nav><div class="product-detail"><div class="detail-gallery"><div class="detail-main-image">${imageMarkup(requireSupabase(), mainImage?.storage_path, mainImage?.alt_text || product.name, 'detail-photo')}</div><div class="detail-thumbnails">${images.map((image,index) => `<button class="thumbnail ${index === 0 ? 'active' : ''}" data-image="${escapeHtml(image.storage_path)}" data-alt="${escapeHtml(image.alt_text || product.name)}">${imageMarkup(requireSupabase(), image.storage_path, image.alt_text || product.name, '')}</button>`).join('')}</div></div><div class="detail-copy"><p class="eyebrow">${escapeHtml(product.categories?.name || 'PRODUCT')}</p><h1>${escapeHtml(product.name)}</h1><div class="detail-sku">SKU: ${escapeHtml(product.sku)}</div><p class="detail-description">${escapeHtml(product.description || product.short_description || '')}</p><dl class="spec-list">${details}${specs}</dl><a class="button-dark" href="#/inquiry?product=${encodeURIComponent(product.id)}">Request Product Inquiry <span>→</span></a></div></div></section>`;
    document.querySelectorAll('.thumbnail').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.thumbnail').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const main = document.querySelector('.detail-main-image');
      main.innerHTML = imageMarkup(requireSupabase(), button.dataset.image, button.dataset.alt, 'detail-photo');
    }));
  } catch (error) { document.querySelector('.detail-page').innerHTML = catalogError(error); }
}

async function inquiryPage(params = '') {
  const query = new URLSearchParams(params);
  let product = null;
  if (query.get('product')) {
    try { const { data } = await requireSupabase().from('products').select('id,name').eq('id', query.get('product')).maybeSingle(); product = data; } catch { /* allow general inquiry if product is unavailable */ }
  }
  shell(`<section class="inquiry-page"><div class="page-heading"><p class="eyebrow">SOURCING INQUIRY</p><h1>Let’s talk <em>products.</em></h1><p>Share a few details and our team will get back to you.</p></div><form class="inquiry-form" id="inquiry-form" novalidate><div class="form-grid"><label>Name <span>*</span><input name="name" required maxlength="120" autocomplete="name" /></label><label>Company<input name="company" maxlength="180" autocomplete="organization" /></label><label>Business Email <span>*</span><input name="business_email" type="email" required maxlength="254" autocomplete="email" /></label><label>Country <span>*</span><input name="country" required maxlength="100" autocomplete="country-name" /></label><label>Product <span>*</span><input name="product_name" required maxlength="180" value="${escapeHtml(product?.name || query.get('name') || '')}" list="catalog-product-options" /><datalist id="catalog-product-options"></datalist></label><label>Estimated Quantity<input name="estimated_quantity" maxlength="80" placeholder="e.g. 500 units" /></label><label class="full-field">Message <span>*</span><textarea name="message" required maxlength="5000" rows="5" placeholder="Tell us about your requirements"></textarea></label><label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off" /></label></div><p class="form-error" id="form-error" role="alert"></p><button class="button-dark" type="submit">Send Inquiry <span>→</span></button><p class="form-note">We’ll use your details only to respond to this sourcing inquiry.</p></form></section>`);
  const form = document.querySelector('#inquiry-form');
  try {
    const { getProducts } = await import('./lib/catalog.js');
    const result = await getProducts({ page: 1, pageSize: 100 });
    document.querySelector('#catalog-product-options').innerHTML = result.products.map((item) => `<option value="${escapeHtml(item.name)}"></option>`).join('');
  } catch { /* product name can still be entered manually */ }
  form.addEventListener('input', () => { delete form.dataset.idempotencyKey; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorNode = document.querySelector('#form-error');
    errorNode.textContent = '';
    const data = Object.fromEntries(new FormData(form).entries());
    for (const field of ['name','business_email','country','product_name','message']) {
      if (!String(data[field] || '').trim()) { errorNode.textContent = 'Please complete all required fields.'; form.elements[field].focus(); return; }
    }
    if (!form.elements.business_email.validity.valid) { errorNode.textContent = 'Enter a valid business email address.'; form.elements.business_email.focus(); return; }
    const submit = form.querySelector('button[type="submit"]'); submit.disabled = true; submit.textContent = 'Sending…';
    const idempotencyKey = form.dataset.idempotencyKey || (form.dataset.idempotencyKey = crypto.randomUUID());
    try {
      const client = requireSupabase();
      const { data: result, error } = await client.functions.invoke('submit-inquiry', {
        body: { ...data, idempotency_key: idempotencyKey, product_id: product?.id || null },
      });
      if (error || !result?.ok) throw new Error(result?.error || error?.message || 'Your inquiry could not be sent. Please try again.');
      form.innerHTML = `<div class="success-state"><div class="empty-icon">✓</div><h2>Inquiry received.</h2><p>Thank you. Your sourcing inquiry has been submitted successfully.</p><a class="button-dark" href="#/products">Continue browsing <span>→</span></a></div>`;
    } catch (error) {
      errorNode.textContent = error.message || 'Your inquiry could not be sent. Please try again.';
      submit.disabled = false; submit.innerHTML = 'Send Inquiry <span>→</span>';
    }
  });
}

async function renderRoute() {
  const raw = location.hash.slice(1) || '/';
  const question = raw.indexOf('?');
  const path = (question === -1 ? raw : raw.slice(0,question)).replace(/\/$/, '') || '/';
  const params = question === -1 ? '' : raw.slice(question + 1);
  window.scrollTo(0,0);
  if (path === '/') return home();
  if (path === '/products' || path === '/categories') return productsPage(params);
  if (path.startsWith('/product/')) return productPage(decodeURIComponent(path.slice('/product/'.length)));
  if (path === '/inquiry') return inquiryPage(params);
  if (path === '/admin') { const { renderAdmin } = await import('./admin.js'); return renderAdmin(app, { header, footer, shell }); }
  if (path === '/about') { shell(`<section class="about-page"><p class="eyebrow">CHINA SOURCING CATALOG</p><h1>Good sourcing starts with a <em>conversation.</em></h1><p>Discover products across multiple categories and contact us for sourcing inquiries.</p><a class="button-dark" href="#/inquiry">Contact Us <span>→</span></a></section>`); return; }
  shell(`<section class="not-found"><h1>Page not found.</h1><a class="button-dark" href="#/">Return home <span>→</span></a></section>`);
}

window.addEventListener('hashchange', renderRoute);
renderRoute();


