# China Sourcing Catalog

An English-only B2B product showcase and sourcing inquiry website for overseas buyers.

## Project status

The site is an English-language B2B catalog for overseas buyers. It includes:

- Responsive home, category, searchable product list, and product detail pages.
- Supabase-backed catalog reads for active categories and published products.
- Product inquiry form routed through a Supabase Edge Function.
- Protected admin sign-in, product and category management, inquiry viewing, CSV/Excel import, and product image uploads.
- Supplier profile management, supplier directory and detail pages, and optional supplier-to-product associations.
- Additive Supabase migrations with Row Level Security and initial catalog categories.

No product or supplier records have been invented. Category fallback cards shown before Supabase is connected are temporary display content; database records become the source of truth once configured.

## Local development

Requires Node.js 20.19+ or 22.12+ and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `.env.local` before connecting the catalog:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

A legacy anon key can also be used as `VITE_SUPABASE_ANON_KEY`. These browser keys are public by design and are safe only with the supplied RLS policies. Never put a Supabase secret/service-role key in a `VITE_` variable or commit it.

## Supabase setup

1. Create or select the Supabase project intended for this catalog.
2. If the catalog schema has not already been installed, run `supabase/migrations/202610260001_catalog_schema.sql` in the Supabase SQL Editor. Then run `supabase/migrations/202610260002_suppliers.sql`. The supplier migration is additive: it creates `suppliers`, adds nullable `products.supplier_id` with `ON DELETE SET NULL`, seeds two apparel subcategories, and adds RLS policies. It does not delete or rewrite existing product or image rows; existing products remain unassigned until linked by an admin.
3. In Supabase Auth, create the first admin user. Then add only that user's UUID to `public.admin_users` using the SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE_AUTH_USER_UUID_HERE');
   ```

   Do not enable public sign-up for the admin interface. The admin page is `/#/admin`.
4. Deploy the inquiry Edge Function from the project root with the Supabase CLI:

   ```powershell
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy submit-inquiry
   supabase secrets set ALLOWED_ORIGINS=https://YOUR_DOMAIN INQUIRY_HASH_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   ```

   Add the Vercel preview origin to `ALLOWED_ORIGINS` when you need inquiry testing on previews. Supabase injects its project URL and secret API key in the Edge Function environment; the function reads those server-side. Never copy that secret into `.env.local` or the browser bundle.
5. Set the two public `VITE_` environment variables in `.env.local` for local development and in the Vercel project settings for deployment.

Customer inquiries are saved in Supabase. No email notification provider is configured, so the site does not claim that an email has been sent.

## Product data import

Open `/#/admin`, sign in, and choose **Import CSV / Excel**. The importer reads CSV and the first worksheet of XLSX files. Save legacy XLS files as XLSX or CSV before importing. Keep the first row as headers. A starting template is in `product-import-template.csv`.

Supported columns:

- Required: `sku`, `name`
- Optional: `category_slug`, `supplier_slug`, `slug`, `short_description`, `description`, `materials`, `dimensions`, `colors`, `models`, `minimum_order_quantity`, `oem_available`, `odm_available`, `is_featured`, `is_published`, `specifications`
- Separate multiple colors/models with `|`.
- `specifications` may be a JSON object, for example `{"Voltage":"220V"}`.
- Category slugs must already exist. A repeated SKU in a file is reported and later duplicates are skipped. An existing SKU is updated; imported records stay unpublished unless `is_published` is true.
- If present, `supplier_slug` must match a supplier profile. Omitting the column keeps existing product-supplier links unchanged; a blank value leaves an existing link unchanged and leaves a new product unassigned.
- Validation and row-level failures are displayed after import. SKU values are normalized to uppercase.

## Product image workflow

Product images use the public `catalog-products` Supabase Storage bucket; image metadata and display order live in `product_images`.

- In the admin product editor, use **Manage Images** for one product.
- For batch upload, name files with the exact product SKU, optionally followed by `_01`, `-02`, or a space and sequence, such as `CS-1001.jpg`, `CS-1001_02.png`, or `CS-1001-03.webp`. Select **Upload Images by SKU** in the products admin screen. Unmatched files and failures are reported.
- Uploads are limited to 8 MB each and resized to a maximum 1800 px edge, then encoded as WebP where supported. If an image fails to load on the site, a placeholder is shown.
- Image files and product text records are stored and updated separately.

Supplier logos reuse the `catalog-products` bucket and are stored below `suppliers/<supplier-id>/`. The supplier record stores only the image path. Supplier profiles appear publicly only after publication; the `Verified` label is shown only when an admin sets the review status to `verified`.

## Vercel and GitHub

The Vite production build is `npm run build`; Vercel's output directory is `dist`. The app uses hash-based routes, so client pages do not need server rewrites. Set the public Supabase variables in the existing Vercel project before deploying the updated application.

Do not commit `.env.local`, `supabase/functions/.env`, or any Supabase secret keys. `.gitignore` excludes local environment files and build output.
