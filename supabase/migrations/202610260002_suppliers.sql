-- Add supplier profiles without changing or deleting existing catalog data.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  introduction text not null default '',
  location text not null default '',
  supplier_type text not null default 'manufacturer'
    check (supplier_type in ('manufacturer', 'trading_company', 'brand_owner', 'other')),
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  website text not null default '',
  whatsapp text not null default '',
  logo_storage_path text,
  transaction_mode text not null default 'B2B Wholesale'
    check (transaction_mode in ('B2B Wholesale', 'B2C Retail', 'Both')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_published_name_idx
  on public.suppliers (is_published, name);
create index if not exists suppliers_transaction_mode_idx
  on public.suppliers (transaction_mode, is_published);

alter table public.products
  add column if not exists supplier_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_supplier_id_fkey'
  ) then
    alter table public.products
      add constraint products_supplier_id_fkey
      foreign key (supplier_id) references public.suppliers(id) on delete set null;
  end if;
end;
$$;

create index if not exists products_supplier_id_idx on public.products (supplier_id);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
revoke all on public.suppliers from public, anon, authenticated;
grant select on public.suppliers to anon, authenticated;
grant insert, update, delete on public.suppliers to authenticated;

drop policy if exists "Public reads published suppliers" on public.suppliers;
create policy "Public reads published suppliers" on public.suppliers
  for select to anon, authenticated using (is_published or (select public.is_catalog_admin()));

drop policy if exists "Admins manage suppliers" on public.suppliers;
create policy "Admins manage suppliers" on public.suppliers
  for all to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

-- More precise apparel categories for supplier and product discovery.
insert into public.categories (slug, name, description, sort_order) values
  ('shoes-footwear', 'Shoes & Footwear', 'Shoes, footwear and related accessories', 21),
  ('clothing-apparel', 'Clothing & Apparel', 'Clothing, garments and fashion apparel', 22)
on conflict (slug) do nothing;

-- Supplier logos share the existing catalog-products bucket and admin-only upload policies.
