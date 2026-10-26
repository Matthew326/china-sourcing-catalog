import Papa from 'papaparse';
import { requireSupabase } from './lib/supabase.js';
import { escapeHtml, imageMarkup, slugify, toast } from './lib/dom.js';

const SELECT = '*, categories(name,slug), product_images(id,storage_path,alt_text,sort_order)';
let currentProducts = [];
let currentCategories = [];
let editingProduct = null;
let editingCategory = null;

function adminFrame(title, content, section = 'products') {
  return `<section class="admin-page"><div class="admin-top"><div><p class="eyebrow">CATALOG MANAGEMENT</p><h1>${escapeHtml(title)}</h1></div><button class="button-light" id="admin-signout">Sign out</button></div><div class="admin-tabs"><button data-admin-section="products" class="${section==='products'?'active':''}">Products</button><button data-admin-section="categories" class="${section==='categories'?'active':''}">Categories</button><button data-admin-section="inquiries" class="${section==='inquiries'?'active':''}">Inquiries</button></div>${content}</section>`;
}
function loginView(app, shell) {
  shell(`<section class="admin-login"><p class="eyebrow">PRIVATE ADMIN AREA</p><h1>Catalog <em>sign in.</em></h1><p>Sign in with an authorized catalog administrator account.</p><form id="admin-login-form" class="admin-login-form"><label>Email<input name="email" type="email" required autocomplete="username" /></label><label>Password<input name="password" type="password" required autocomplete="current-password" /></label><p class="form-error" id="login-error" role="alert"></p><button class="button-dark" type="submit">Sign In <span>→</span></button></form></section>`);
  document.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());
    const { error } = await requireSupabase().auth.signInWithPassword({ email: values.email, password: values.password });
    if (error) { document.querySelector('#login-error').textContent = 'Sign in failed. Check your credentials and try again.'; button.disabled = false; return; }
    await renderAdmin(app, { shell });
  });
}

async function authorizedUser() {
  const db = requireSupabase();
  const { data: userResult, error: userError } = await db.auth.getUser();
  if (userError || !userResult.user) return null;
  const { data: isAdmin, error } = await db.rpc('is_catalog_admin');
  if (error || !isAdmin) return null;
  return userResult.user;
}

async function loadCategories() {
  const { data, error } = await requireSupabase().from('categories').select('*').order('sort_order').order('name');
  if (error) throw error; currentCategories = data || []; return currentCategories;
}
async function loadProducts() {
  const { data, error } = await requireSupabase().from('products').select(SELECT).order('updated_at', { ascending: false }).limit(100);
  if (error) throw error; currentProducts = data || []; return currentProducts;
}

function productsView() {
  return adminFrame('Products', `<div class="admin-toolbar"><p>Manage catalog products. CSV/Excel import updates a product when its SKU matches.</p><div><button class="button-light" id="csv-import-button">Import CSV / Excel</button><button class="button-light" id="bulk-image-upload-button">Upload Images by SKU</button><button class="button-dark" id="new-product">Add Product <span>＋</span></button><input id="csv-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden /><input id="bulk-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden /></div></div><div id="csv-report" class="import-report" hidden></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>${currentProducts.length ? currentProducts.map((product) => `<tr><td><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.short_description || '')}</small></td><td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.categories?.name || 'Uncategorized')}</td><td><span class="status-chip ${product.is_published?'published':''}">${product.is_published?'Published':'Draft'}</span></td><td class="table-actions"><button data-edit-product="${product.id}">Edit</button><button class="danger-action" data-delete-product="${product.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-table">No products yet. Add one or import a CSV file.</td></tr>'}</tbody></table></div><div id="admin-editor"></div>`, 'products');
}
function categoriesView() {
  return adminFrame('Categories', `<div class="admin-toolbar"><p>Categories are managed in the database and can be changed at any time.</p><button class="button-dark" id="new-category">Add Category <span>＋</span></button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Category</th><th>Slug</th><th>Order</th><th>Visibility</th><th></th></tr></thead><tbody>${currentCategories.length ? currentCategories.map((category) => `<tr><td><b>${escapeHtml(category.name)}</b><small>${escapeHtml(category.description || '')}</small></td><td>${escapeHtml(category.slug)}</td><td>${category.sort_order}</td><td><span class="status-chip ${category.is_active?'published':''}">${category.is_active?'Active':'Hidden'}</span></td><td class="table-actions"><button data-edit-category="${category.id}">Edit</button><button class="danger-action" data-delete-category="${category.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-table">No categories yet.</td></tr>'}</tbody></table></div><div id="category-editor"></div>`, 'categories');
}
async function inquiriesView() {
  const { data, error } = await requireSupabase().from('inquiries').select('*').order('created_at', { ascending: false }).limit(200);
  const rows = error ? `<tr><td colspan="6" class="empty-table">${escapeHtml(error.message)}</td></tr>` : data?.length ? data.map((item) => `<tr><td>${new Date(item.created_at).toLocaleString()}</td><td><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.company || '')}</small></td><td><a href="mailto:${encodeURIComponent(item.business_email)}">${escapeHtml(item.business_email)}</a><small>${escapeHtml(item.country)}</small></td><td>${escapeHtml(item.product_name)}<small>${escapeHtml(item.estimated_quantity || '')}</small></td><td class="inquiry-message">${escapeHtml(item.message)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-table">No inquiries have been received.</td></tr>';
  return adminFrame('Inquiries', `<div class="admin-toolbar"><p>Customer inquiry records are visible only to authorized administrators.</p><span>${data?.length || 0} recent records</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Received</th><th>Name / Company</th><th>Business Email</th><th>Product / Quantity</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table></div>`, 'inquiries');
}
function categoryEditor(category = null) {
  editingCategory = category?.id || null;
  const target = document.querySelector('#category-editor');
  target.innerHTML = `<form class="admin-form" id="category-form"><div class="form-heading"><h2>${category?'Edit':'Add'} Category</h2><button type="button" class="close-editor" id="close-category-editor">×</button></div><label>Name<input name="name" required maxlength="100" value="${escapeHtml(category?.name || '')}" /></label><label>Slug<input name="slug" required maxlength="100" value="${escapeHtml(category?.slug || '')}" /></label><label>Description<textarea name="description" maxlength="500">${escapeHtml(category?.description || '')}</textarea></label><div class="form-row"><label>Display Order<input name="sort_order" type="number" value="${category?.sort_order ?? 0}" /></label><label class="checkbox-label"><input name="is_active" type="checkbox" ${category?.is_active === false?'':'checked'} /> Visible to customers</label></div><button class="button-dark" type="submit">Save Category <span>→</span></button><p class="form-error" id="category-error"></p></form>`;
  const form = target.querySelector('form'); form.elements.name.addEventListener('input', () => { if (!editingCategory || !form.elements.slug.dataset.touched) form.elements.slug.value = slugify(form.elements.name.value); });
  form.elements.slug.addEventListener('input', () => form.elements.slug.dataset.touched='true');
  target.querySelector('#close-category-editor').onclick = () => target.innerHTML = '';
  form.onsubmit = async (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const record = { name: values.name.trim(), slug: slugify(values.slug), description: values.description.trim(), sort_order: Number(values.sort_order) || 0, is_active: form.elements.is_active.checked };
    const query = requireSupabase().from('categories'); const result = editingCategory ? await query.update(record).eq('id', editingCategory) : await query.insert(record);
    if (result.error) { target.querySelector('#category-error').textContent = result.error.message; return; }
    toast('Category saved.', 'success'); await renderSection('categories');
  };
}
function productEditor(product = null) {
  editingProduct = product?.id || null;
  const target = document.querySelector('#admin-editor');
  target.innerHTML = `<form class="admin-form product-admin-form" id="product-form"><div class="form-heading"><h2>${product?'Edit':'Add'} Product</h2><button type="button" class="close-editor" id="close-product-editor">×</button></div><div class="form-grid"><label>Product Name <span>*</span><input name="name" required maxlength="180" value="${escapeHtml(product?.name || '')}" /></label><label>SKU <span>*</span><input name="sku" required maxlength="80" value="${escapeHtml(product?.sku || '')}" placeholder="e.g. CS-1001" /></label><label>Slug<input name="slug" value="${escapeHtml(product?.slug || '')}" /></label><label>Category<select name="category_id"><option value="">Uncategorized</option>${currentCategories.map((category)=>`<option value="${category.id}" ${product?.category_id===category.id?'selected':''}>${escapeHtml(category.name)}</option>`).join('')}</select></label><label class="full-field">Short Description<textarea name="short_description" maxlength="500" rows="2">${escapeHtml(product?.short_description || '')}</textarea></label><label class="full-field">Product Description<textarea name="description" rows="4">${escapeHtml(product?.description || '')}</textarea></label><label>Material<input name="materials" value="${escapeHtml(product?.materials || '')}" /></label><label>Dimensions<input name="dimensions" value="${escapeHtml(product?.dimensions || '')}" /></label><label>Colors (comma separated)<input name="colors" value="${escapeHtml(product?.colors?.join(', ') || '')}" /></label><label>Models (comma separated)<input name="models" value="${escapeHtml(product?.models?.join(', ') || '')}" /></label><label>Minimum Order Quantity<input name="minimum_order_quantity" type="number" min="1" value="${product?.minimum_order_quantity ?? ''}" /></label><label>Specifications (JSON)<textarea name="specifications" rows="3">${escapeHtml(JSON.stringify(product?.specifications || {}, null, 2))}</textarea></label><label>OEM Availability<select name="oem_available"><option value="">Not provided</option><option value="true" ${product?.oem_available===true?'selected':''}>Available</option><option value="false" ${product?.oem_available===false?'selected':''}>Not available</option></select></label><label>ODM Availability<select name="odm_available"><option value="">Not provided</option><option value="true" ${product?.odm_available===true?'selected':''}>Available</option><option value="false" ${product?.odm_available===false?'selected':''}>Not available</option></select></label><div class="check-row"><label class="checkbox-label"><input name="is_featured" type="checkbox" ${product?.is_featured?'checked':''} /> Featured</label><label class="checkbox-label"><input name="is_published" type="checkbox" ${product?.is_published?'checked':''} /> Published</label></div></div><p class="form-error" id="product-error"></p><div class="form-actions"><button class="button-dark" type="submit">Save Product <span>→</span></button>${product?'<button type="button" class="button-light" id="open-images">Manage Images</button>':''}</div></form><div id="image-editor"></div>`;
  const form = target.querySelector('#product-form'); form.elements.name.addEventListener('input', () => { if (!editingProduct || !form.elements.slug.dataset.touched) form.elements.slug.value=slugify(form.elements.name.value); }); form.elements.slug.addEventListener('input',()=>form.elements.slug.dataset.touched='true');
  target.querySelector('#close-product-editor').onclick = () => { target.innerHTML=''; editingProduct=null; };
  form.onsubmit = async (event) => {
    event.preventDefault();
    let specifications;
    try { specifications = form.elements.specifications.value.trim() ? JSON.parse(form.elements.specifications.value) : {}; if (!specifications || Array.isArray(specifications) || typeof specifications !== 'object') throw new Error(); }
    catch { target.querySelector('#product-error').textContent='Specifications must be a valid JSON object.'; return; }
    const sku = form.elements.sku.value.trim().toUpperCase();
    const record = { name: form.elements.name.value.trim(), sku, slug: slugify(form.elements.slug.value || `${form.elements.name.value}-${sku}`), category_id: form.elements.category_id.value || null, short_description: form.elements.short_description.value.trim(), description: form.elements.description.value.trim(), materials: form.elements.materials.value.trim() || null, dimensions: form.elements.dimensions.value.trim() || null, colors: form.elements.colors.value.split(',').map(x=>x.trim()).filter(Boolean), models: form.elements.models.value.split(',').map(x=>x.trim()).filter(Boolean), minimum_order_quantity: form.elements.minimum_order_quantity.value ? Number(form.elements.minimum_order_quantity.value) : null, oem_available: form.elements.oem_available.value===''?null:form.elements.oem_available.value==='true', odm_available: form.elements.odm_available.value===''?null:form.elements.odm_available.value==='true', is_featured: form.elements.is_featured.checked, is_published: form.elements.is_published.checked, specifications };
    const query = requireSupabase().from('products'); const result = editingProduct ? await query.update(record).eq('id',editingProduct).select('id').single() : await query.insert(record).select('id').single();
    if(result.error){target.querySelector('#product-error').textContent=result.error.message;return;}
    toast('Product saved.', 'success'); await renderSection('products');
    if(!editingProduct){const found=currentProducts.find(p=>p.id===result.data.id);if(found)productEditor(found);}
  };
  if(product) target.querySelector('#open-images').onclick = () => imageEditor(product);
}

async function imageEditor(product) {
  const target=document.querySelector('#image-editor');
  const {data:images,error}=await requireSupabase().from('product_images').select('*').eq('product_id',product.id).order('sort_order');
  if(error){target.innerHTML=`<p class="form-error">${escapeHtml(error.message)}</p>`;return;}
  target.innerHTML=`<div class="image-manager"><h3>Product Images</h3><p>Images are resized to a maximum 1800px edge and saved as WebP when the browser supports it.</p><div class="image-admin-grid">${(images||[]).map(image=>`<div class="image-admin-card">${imageMarkup(requireSupabase(),image.storage_path,image.alt_text,'')}<div><small>${escapeHtml(image.storage_path)}</small><button class="danger-action" data-remove-image="${image.id}" data-path="${escapeHtml(image.storage_path)}">Remove</button></div></div>`).join('')}</div><form id="upload-images-form" class="upload-form"><label>Choose images<input name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple required /></label><label>Alt text<input name="alt_text" maxlength="250" placeholder="Optional shared description" /></label><button class="button-dark" type="submit">Upload Images <span>↑</span></button><p class="form-error" id="image-error"></p></form></div>`;
  target.querySelectorAll('[data-remove-image]').forEach(button=>button.onclick=async()=>{if(!confirm('Remove this image from the product?'))return;const path=button.dataset.path;const storage=await requireSupabase().storage.from('catalog-products').remove([path]);if(storage.error){toast(storage.error.message,'error');return;}const removed=await requireSupabase().from('product_images').delete().eq('id',button.dataset.removeImage);if(removed.error){toast(removed.error.message,'error');return;}imageEditor(product);});
  target.querySelector('#upload-images-form').onsubmit=async(event)=>{event.preventDefault();const form=event.currentTarget;const files=[...form.elements.images.files];const errorNode=form.querySelector('#image-error');const button=form.querySelector('button');button.disabled=true;errorNode.textContent='';let order=images.length;
    for(const file of files){if(file.size>8*1024*1024){errorNode.textContent=`${file.name} exceeds the 8 MB upload limit.`;break;}try{const blob=await compressImage(file);const path=`${product.id}/${crypto.randomUUID()}.webp`;const upload=await requireSupabase().storage.from('catalog-products').upload(path,blob,{contentType:blob.type||'image/webp',upsert:false});if(upload.error)throw upload.error;const record=await requireSupabase().from('product_images').insert({product_id:product.id,storage_path:path,alt_text:form.elements.alt_text.value.trim(),sort_order:order++});if(record.error){await requireSupabase().storage.from('catalog-products').remove([path]);throw record.error;}}catch(error){errorNode.textContent=error.message||'An image could not be uploaded.';break;}}
    button.disabled=false;if(!errorNode.textContent){toast('Images uploaded.','success');imageEditor(product);}
  };
}
async function compressImage(file){const bitmap=await createImageBitmap(file);const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image processing failed.')),'image/webp',0.84));}

async function importCsv(file) {
  const report=document.querySelector('#csv-report'); report.hidden=false; report.textContent='Reading CSV…';
  let parsed;
  if (/\.xlsx?$/i.test(file.name)) {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()));
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('Workbook has no worksheet.');
      const headers = sheet.getRow(1).values.slice(1).map(value => String(value ?? '').trim().toLowerCase());
      const rows = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = {};
        headers.forEach((header, index) => { if (header) record[header] = String(row.getCell(index + 1).text ?? '').trim(); });
        if (Object.values(record).some(value => value !== '')) rows.push(record);
      });
      parsed = { data: rows, errors: [] };
    } catch { parsed = { data: [], errors: [{ row: 0, message: 'Could not read the XLSX workbook.' }] }; }
  } else {
    parsed = Papa.parse(file,{header:true,skipEmptyLines:'greedy',transformHeader:header=>header.trim().toLowerCase()});
  }
  if(parsed.errors.length){report.textContent=`CSV parsing error: ${parsed.errors.slice(0,5).map(e=>`row ${e.row+1}: ${e.message}`).join('; ')}`;return;}
  const categories=await loadCategories();const categoryBySlug=new Map(categories.map(c=>[c.slug,c.id]));const seen=new Set();const valid=[];const errors=[];
  parsed.data.forEach((row,index)=>{const rowNumber=index+2;const sku=String(row.sku||'').trim().toUpperCase();const name=String(row.name||'').trim();if(!sku||!name){errors.push(`Row ${rowNumber}: SKU and name are required.`);return;}if(seen.has(sku)){errors.push(`Row ${rowNumber}: duplicate SKU ${sku} in this file; the first row is kept.`);return;}seen.add(sku);const categorySlug=String(row.category_slug||'').trim();if(categorySlug&&!categoryBySlug.has(categorySlug)){errors.push(`Row ${rowNumber}: unknown category_slug ${categorySlug}.`);return;}let specifications={};if(row.specifications){try{specifications=JSON.parse(row.specifications);if(!specifications||Array.isArray(specifications)||typeof specifications!=='object')throw new Error();}catch{errors.push(`Row ${rowNumber}: specifications must be a JSON object.`);return;}}
    const boolean=(value)=>String(value||'').toLowerCase()==='true'||String(value||'')==='1';const quantity=String(row.minimum_order_quantity||'').trim();if(quantity&&(!/^\d+$/.test(quantity)||Number(quantity)<1)){errors.push(`Row ${rowNumber}: minimum_order_quantity must be a positive integer.`);return;}
    valid.push({sku,name,slug:slugify(row.slug||`${name}-${sku}`),category_id:categorySlug?categoryBySlug.get(categorySlug):null,short_description:String(row.short_description||''),description:String(row.description||''),materials:String(row.materials||'')||null,dimensions:String(row.dimensions||'')||null,colors:String(row.colors||'').split('|').map(x=>x.trim()).filter(Boolean),models:String(row.models||'').split('|').map(x=>x.trim()).filter(Boolean),minimum_order_quantity:quantity?Number(quantity):null,oem_available:row.oem_available===''?null:boolean(row.oem_available),odm_available:row.odm_available===''?null:boolean(row.odm_available),is_featured:boolean(row.is_featured),is_published:boolean(row.is_published),specifications});
  });
  if (!valid.length) { report.textContent = `Nothing imported. ${errors.length} row issue(s) found.`; return; }
  const existingSkus = new Set();
  for (let start=0;start<valid.length;start+=500) {
    const keys=valid.slice(start,start+500).map(item=>item.sku);
    const {data,error}=await requireSupabase().from('products').select('sku').in('sku',keys);
    if(error) throw error;
    for(const row of data||[])existingSkus.add(row.sku);
  }
  if (existingSkus.size && !confirm(`${existingSkus.size} SKU(s) already exist. Their catalog fields will be replaced by the matching spreadsheet rows. Continue?`)) {
    report.textContent = `Import cancelled. No product records were changed. ${errors.length} row issue(s) were found during validation.`;
    return;
  }
  let imported=0;for(let start=0;start<valid.length;start+=50){const batch=valid.slice(start,start+50);const result=await requireSupabase().from('products').upsert(batch,{onConflict:'sku'});if(!result.error){imported+=batch.length;continue;}for(let i=0;i<batch.length;i++){const single=await requireSupabase().from('products').upsert(batch[i],{onConflict:'sku'});if(single.error)errors.push(`CSV row ${start+i+2}: ${single.error.message}`);else imported++;}}
  report.innerHTML=`<b>Import complete: ${imported} saved, ${errors.length} issue(s).</b>${errors.length?`<ul>${errors.map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ul>`:''}`;await renderSection('products');document.querySelector('#csv-report').hidden=false;document.querySelector('#csv-report').innerHTML=`<b>Import complete: ${imported} saved, ${errors.length} issue(s).</b>${errors.length?`<ul>${errors.map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ul>`:''}`;
}

async function bulkImportImages(files) {
  const report = document.querySelector('#csv-report'); report.hidden = false; report.textContent = 'Matching image filenames to product SKUs…';
  const db = requireSupabase(); const allProducts = []; let offset = 0;
  while (true) { const { data, error } = await db.from('products').select('id,sku').range(offset, offset + 999); if (error) throw error; allProducts.push(...(data || [])); if (!data || data.length < 1000) break; offset += 1000; }
  const products = [...allProducts].sort((a,b)=>b.sku.length-a.sku.length);
  const matches = []; const unmatched = [];
  for (const file of files) {
    const stem = file.name.replace(/\.[^.]+$/, '').trim().toUpperCase();
    const product = products.find(item => stem === item.sku || stem.startsWith(`${item.sku}_`) || stem.startsWith(`${item.sku}-`) || stem.startsWith(`${item.sku} `));
    if (product) matches.push({file,product}); else unmatched.push(file.name);
  }
  matches.sort((a,b)=>a.product.sku.localeCompare(b.product.sku)||a.file.name.localeCompare(b.file.name,undefined,{numeric:true}));
  const ids = [...new Set(matches.map(item=>item.product.id))]; const orders = new Map();
  if(ids.length){const {data:rows,error}=await db.from('product_images').select('product_id,sort_order').in('product_id',ids);if(error)throw error;for(const row of rows||[])orders.set(row.product_id,Math.max(orders.get(row.product_id)||0,row.sort_order+1));}
  const errors=[];let uploaded=0;
  for(const {file,product} of matches){if(file.size>8*1024*1024){errors.push(`${file.name}: exceeds the 8 MB limit.`);continue;}try{const blob=await compressImage(file);const path=`${product.sku}/${crypto.randomUUID()}.webp`;const result=await db.storage.from('catalog-products').upload(path,blob,{contentType:blob.type||'image/webp',upsert:false});if(result.error)throw result.error;const row=await db.from('product_images').insert({product_id:product.id,storage_path:path,alt_text:file.name.replace(/\.[^.]+$/,''),sort_order:orders.get(product.id)||0});if(row.error){await db.storage.from('catalog-products').remove([path]);throw row.error;}orders.set(product.id,(orders.get(product.id)||0)+1);uploaded++;}catch(error){errors.push(`${file.name}: ${error.message||'upload failed'}`);}}
  report.innerHTML=`<b>Image upload complete: ${uploaded} uploaded, ${unmatched.length} unmatched, ${errors.length} failed.</b>${unmatched.length?`<p>Unmatched files: ${unmatched.map(escapeHtml).join(', ')}</p>`:''}${errors.length?`<ul>${errors.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:''}`;
}
function wireProductSection() {
  document.querySelector('#new-product').onclick=()=>productEditor();
  document.querySelector('#csv-import-button').onclick=()=>document.querySelector('#csv-file').click();
  document.querySelector('#bulk-image-upload-button').onclick=()=>document.querySelector('#bulk-image-file').click();
  document.querySelector('#bulk-image-file').onchange=async(event)=>{const files=[...(event.target.files||[])];if(files.length)try{await bulkImportImages(files);}catch(error){toast(error.message,'error');}};
  document.querySelector('#csv-file').onchange=(event)=>{const file=event.target.files?.[0];if(file)importCsv(file).catch(error=>toast(error.message,'error'));};
  document.querySelectorAll('[data-edit-product]').forEach(button=>button.onclick=()=>{const product=currentProducts.find(p=>p.id===button.dataset.editProduct);if(product)productEditor(product);});
  document.querySelectorAll('[data-delete-product]').forEach(button=>button.onclick=async()=>{const product=currentProducts.find(p=>p.id===button.dataset.deleteProduct);if(!product||!confirm(`Delete ${product.name} and its product images?`))return;const paths=(product.product_images||[]).map(image=>image.storage_path);if(paths.length){const removed=await requireSupabase().storage.from('catalog-products').remove(paths);if(removed.error){toast(removed.error.message,'error');return;}}const result=await requireSupabase().from('products').delete().eq('id',product.id);if(result.error){toast(result.error.message,'error');return;}toast('Product deleted.','success');await renderSection('products');});
}
function wireCategorySection() {
  document.querySelector('#new-category').onclick=()=>categoryEditor();
  document.querySelectorAll('[data-edit-category]').forEach(button=>button.onclick=()=>{const category=currentCategories.find(c=>c.id===button.dataset.editCategory);if(category)categoryEditor(category);});
  document.querySelectorAll('[data-delete-category]').forEach(button=>button.onclick=async()=>{const category=currentCategories.find(c=>c.id===button.dataset.deleteCategory);if(!category||!confirm(`Delete category ${category.name}? Products will remain but become uncategorized.`))return;const result=await requireSupabase().from('categories').delete().eq('id',category.id);if(result.error){toast(result.error.message,'error');return;}toast('Category deleted.','success');await renderSection('categories');});
}

async function renderSection(section) {
  if(section==='categories') { await loadCategories(); document.querySelector('main').innerHTML=categoriesView(); wireCategorySection(); }
  else if(section==='inquiries') { document.querySelector('main').innerHTML=await inquiriesView(); }
  else { await loadCategories(); await loadProducts(); document.querySelector('main').innerHTML=productsView(); wireProductSection(); }
  wireAdminNav();
}
function wireAdminNav(){
  document.querySelectorAll('[data-admin-section]').forEach(button=>button.onclick=()=>renderSection(button.dataset.adminSection));
  document.querySelector('#admin-signout')?.addEventListener('click',async()=>{await requireSupabase().auth.signOut();location.reload();});
}

export async function renderAdmin(app, { shell }) {
  try {
    if (!requireSupabase()) throw new Error('');
    const user=await authorizedUser();
    if(!user){await requireSupabase().auth.signOut();loginView(app,shell);return;}
    await loadCategories(); await loadProducts();
    app.querySelector('main').innerHTML=productsView();wireProductSection();wireAdminNav();
    document.querySelectorAll('[data-admin-section]').forEach(button=>button.onclick=()=>renderSection(button.dataset.adminSection));
  } catch(error) { shell(`<section class="admin-login"><p class="eyebrow">PRIVATE ADMIN AREA</p><h1>Setup <em>required.</em></h1><p>${escapeHtml(error.message||'The admin area is unavailable until Supabase is configured.')}</p></section>`); }
}


