-- Initial catalog schema. Safe to re-run: additive objects and no data removal.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  cover_image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  sku text not null check (length(trim(sku)) between 1 and 80 and sku = upper(sku)),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 180),
  short_description text not null default '' check (length(short_description) <= 500),
  description text not null default '',
  specifications jsonb not null default '{}'::jsonb check (jsonb_typeof(specifications) = 'object'),
  materials text,
  dimensions text,
  colors text[] not null default '{}',
  models text[] not null default '{}',
  minimum_order_quantity integer check (minimum_order_quantity is null or minimum_order_quantity > 0),
  oem_available boolean,
  odm_available boolean,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_sku_lower_unique on public.products (lower(sku));
create index if not exists products_category_published_idx on public.products (category_id, is_published, created_at desc);
create index if not exists products_search_idx on public.products using gin (
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(short_description, '') || ' ' || coalesce(description, ''))
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '' check (length(alt_text) <= 250),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_order_idx on public.product_images (product_id, sort_order, created_at);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  name text not null check (length(trim(name)) between 1 and 120),
  company text check (company is null or length(company) <= 180),
  business_email text not null check (length(business_email) between 3 and 254 and business_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  country text not null check (length(trim(country)) between 2 and 100),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (length(trim(product_name)) between 1 and 180),
  estimated_quantity text check (estimated_quantity is null or length(estimated_quantity) <= 80),
  message text not null check (length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists private.inquiry_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  submissions integer not null default 0 check (submissions >= 0),
  primary key (ip_hash, window_start)
);
revoke all on private.inquiry_rate_limits from public, anon, authenticated;

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_users enable row level security;
alter table private.inquiry_rate_limits enable row level security;

revoke all on public.categories, public.products, public.product_images, public.inquiries, public.admin_users from public, anon, authenticated;
grant select on public.categories, public.products, public.product_images to anon, authenticated;
grant select, insert, update, delete on public.categories, public.products, public.product_images to authenticated;
grant select on public.inquiries to authenticated;

drop policy if exists "Public reads active categories" on public.categories;
create policy "Public reads active categories" on public.categories for select to anon, authenticated using (is_active or (select public.is_catalog_admin()));
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

drop policy if exists "Public reads published products" on public.products;
create policy "Public reads published products" on public.products for select to anon, authenticated using (
  is_published and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
  or (select public.is_catalog_admin())
);
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

drop policy if exists "Public reads published product images" on public.product_images;
create policy "Public reads published product images" on public.product_images for select to anon, authenticated using (
  exists (select 1 from public.products p join public.categories c on c.id = p.category_id where p.id = product_id and p.is_published and c.is_active)
  or (select public.is_catalog_admin())
);
drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins manage product images" on public.product_images for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

drop policy if exists "Admins read inquiries" on public.inquiries;
create policy "Admins read inquiries" on public.inquiries for select to authenticated using ((select public.is_catalog_admin()));
-- No anon/authenticated INSERT/UPDATE/DELETE policies: all inquiries go through the validated Edge Function.
drop policy if exists "Admins read admin users" on public.admin_users;
create policy "Admins read admin users" on public.admin_users for select to authenticated using ((select public.is_catalog_admin()));

insert into public.categories (slug, name, description, sort_order) values
  ('jewelry-accessories', 'Jewelry & Accessories', 'Jewelry, watches and fashion accessories', 10),
  ('apparel-footwear-bags', 'Apparel, Footwear & Bags', 'Clothing, shoes, bags and textiles', 20),
  ('electronics-accessories', 'Electronics & Accessories', 'Consumer electronics and components', 30),
  ('machinery-industrial-equipment', 'Machinery & Industrial Equipment', 'Industrial machinery, tools and equipment', 40),
  ('construction-building-materials', 'Construction & Building Materials', 'Building materials, hardware and fittings', 50),
  ('energy-storage-new-energy', 'Energy Storage & New Energy', 'Batteries, storage systems and solar equipment', 60),
  ('furniture-home-furnishings', 'Furniture & Home Furnishings', 'Furniture, lighting and home décor', 70)
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-products', 'catalog-products', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads catalog images" on storage.objects;
create policy "Public reads catalog images" on storage.objects for select to anon, authenticated using (bucket_id = 'catalog-products');
drop policy if exists "Admins upload catalog images" on storage.objects;
create policy "Admins upload catalog images" on storage.objects for insert to authenticated with check (bucket_id = 'catalog-products' and (select public.is_catalog_admin()));
drop policy if exists "Admins update catalog images" on storage.objects;
create policy "Admins update catalog images" on storage.objects for update to authenticated using (bucket_id = 'catalog-products' and (select public.is_catalog_admin())) with check (bucket_id = 'catalog-products' and (select public.is_catalog_admin()));
drop policy if exists "Admins delete catalog images" on storage.objects;
create policy "Admins delete catalog images" on storage.objects for delete to authenticated using (bucket_id = 'catalog-products' and (select public.is_catalog_admin()));

create or replace function public.submit_catalog_inquiry(
  p_idempotency_key uuid,
  p_name text,
  p_company text,
  p_business_email text,
  p_country text,
  p_product_id uuid,
  p_product_name text,
  p_estimated_quantity text,
  p_message text,
  p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
  v_window timestamptz := date_trunc('hour', now());
  v_product_name text := nullif(trim(p_product_name), '');
begin
  if p_idempotency_key is null or p_ip_hash is null or length(p_ip_hash) < 32 then
    raise exception using errcode = '22023', message = 'Invalid request.';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120
    or p_business_email is null or length(p_business_email) > 254 or p_business_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_country is null or length(trim(p_country)) not between 2 and 100
    or v_product_name is null or length(v_product_name) > 180
    or p_message is null or length(trim(p_message)) not between 1 and 5000
    or coalesce(length(p_company), 0) > 180
    or coalesce(length(p_estimated_quantity), 0) > 80 then
    raise exception using errcode = '22023', message = 'Please check the inquiry fields.';
  end if;

  select i.id into v_id from public.inquiries i where i.idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  delete from private.inquiry_rate_limits where window_start < now() - interval '48 hours';
  insert into private.inquiry_rate_limits (ip_hash, window_start, submissions)
  values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start) do update
    set submissions = private.inquiry_rate_limits.submissions + 1
    where private.inquiry_rate_limits.submissions < 8
  returning submissions into v_count;
  if v_count is null then
    raise exception using errcode = 'P0001', message = 'Inquiry limit reached. Please try again later.';
  end if;

  if p_product_id is not null then
    select p.name into v_product_name from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = p_product_id and p.is_published and c.is_active;
    if v_product_name is null then
      raise exception using errcode = '22023', message = 'Selected product is not available.';
    end if;
  end if;

  insert into public.inquiries (idempotency_key, name, company, business_email, country, product_id, product_name, estimated_quantity, message)
  values (p_idempotency_key, trim(p_name), nullif(trim(coalesce(p_company, '')), ''), lower(trim(p_business_email)), trim(p_country), p_product_id, v_product_name,
          nullif(trim(coalesce(p_estimated_quantity, '')), ''), trim(p_message))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_catalog_inquiry(uuid,text,text,text,text,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_catalog_inquiry(uuid,text,text,text,text,uuid,text,text,text,text) to service_role;
