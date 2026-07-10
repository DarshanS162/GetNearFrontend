# GetNear — Complete Setup Guide

End-to-end setup for the GetNear food ordering platform: frontend, Supabase database, migrations, auth, storage, and payments.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Frontend Setup](#3-frontend-setup)
4. [Supabase Project Setup](#4-supabase-project-setup)
5. [Database Migrations](#5-database-migrations)
6. [Environment Variables](#6-environment-variables)
7. [Authentication (Phone OTP)](#7-authentication-phone-otp)
8. [Storage Buckets](#8-storage-buckets)
9. [Razorpay Setup](#9-razorpay-setup)
10. [Seed Initial Data](#10-seed-initial-data)
11. [Run the Application](#11-run-the-application)
12. [Verify Setup](#12-verify-setup)
13. [Useful Commands Reference](#13-useful-commands-reference)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Install the following before starting:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18+ (20 LTS recommended) | https://nodejs.org |
| **npm** | Comes with Node.js | — |
| **Git** | Latest | https://git-scm.com |
| **Supabase CLI** | Latest | See below |
| **Supabase account** | Free tier OK | https://supabase.com |
| **Razorpay account** | Test mode OK | https://razorpay.com |

### Install Supabase CLI

**Windows (PowerShell — recommended):**

```powershell
npm install -g supabase
```

**macOS:**

```bash
brew install supabase/tap/supabase
```

**Linux:**

```bash
npm install -g supabase
```

Verify installation:

```bash
supabase --version
node --version
npm --version
```

---

## 2. Project Structure

```
GetNearFrontend/
├── Requirement.md          # Business & database requirements
├── SETUPGUIDE.md           # This file
└── GetNear/                # React + Vite frontend
    ├── .env.example        # Environment variable template
    ├── package.json
    ├── src/
    │   └── lib/supabase.js # Supabase client
    └── supabase/
        ├── DATABASE.md     # ER diagram & schema docs
        ├── README.md       # Supabase quick reference
        └── migrations/     # 24 SQL migration files (000–023)
```

All commands below assume you are inside the `GetNear` folder unless stated otherwise.

---

## 3. Frontend Setup

### Step 3.1 — Navigate to project

**Windows (PowerShell):**

```powershell
cd C:\Users\farin\OneDrive\Desktop\Shahan\GetNearFrontend\GetNear
```

**macOS / Linux:**

```bash
cd /path/to/GetNearFrontend/GetNear
```

### Step 3.2 — Install dependencies

```bash
npm install
```

### Step 3.3 — Confirm install

```bash
npm run lint
```

If lint passes (or only shows warnings), the frontend scaffold is ready.

---

## 4. Supabase Project Setup

### Step 4.1 — Create a Supabase project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose organization, name (e.g. `getnear`), database password, and region
4. Wait for the project to finish provisioning (~2 minutes)

### Step 4.2 — Collect project credentials

In Supabase Dashboard → **Project Settings** → **API**:

| Key | Where to use |
|-----|--------------|
| **Project URL** | `VITE_SUPABASE_URL` |
| **anon public key** | `VITE_SUPABASE_ANON_KEY` |
| **service_role key** | Backend/admin only — **never** put in frontend `.env` |

Also note your **Project Reference ID** (e.g. `abcdefghijklmnop`) from:

**Project Settings → General → Reference ID**

You need this for `supabase link`.

### Step 4.3 — Login to Supabase CLI

```bash
supabase login
```

This opens a browser to authenticate. After login, return to the terminal.

### Step 4.4 — Link local project to Supabase

Run from the `GetNear` folder:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your actual reference ID.

When prompted, enter your **database password** (set during project creation).

---

## 5. Database Migrations

There are **25 migration files** in `GetNear/supabase/migrations/`. They must run **in order** (000 → 024).

### Migration file list

| # | File | Creates |
|---|------|---------|
| 000 | `000_init_extensions_and_functions.sql` | Extensions + `set_updated_at()` trigger |
| 001 | `001_create_roles.sql` | `roles` |
| 002 | `002_create_users.sql` | `users` |
| 003 | `003_create_restaurants.sql` | `restaurants` |
| 004 | `004_create_restaurant_branches.sql` | `restaurant_branches` |
| 005 | `005_create_addresses.sql` | `addresses` |
| 006 | `006_create_categories.sql` | `categories` |
| 007 | `007_create_products.sql` | `products` |
| 008 | `008_create_product_images.sql` | `product_images` |
| 009 | `009_create_cart.sql` | `cart` |
| 010 | `010_create_cart_items.sql` | `cart_items` |
| 011 | `011_create_coupons.sql` | `coupons` |
| 012 | `012_create_offers.sql` | `offers` |
| 013 | `013_create_business_settings.sql` | `business_settings` |
| 014 | `014_create_delivery_charges.sql` | `delivery_charges` |
| 015 | `015_create_operating_hours.sql` | `operating_hours` |
| 016 | `016_create_holidays.sql` | `holidays` |
| 017 | `017_create_orders.sql` | `orders` |
| 018 | `018_create_order_items.sql` | `order_items` |
| 019 | `019_create_payments.sql` | `payments` |
| 020 | `020_create_coupon_usages.sql` | `coupon_usages` |
| 021 | `021_create_notifications.sql` | `notifications` |
| 022 | `022_create_reviews.sql` | `reviews` |
| 023 | `023_create_favorites.sql` | `favorites` |
| 024 | `024_seed_admin_users.sql` | Admin users (Farine Khan, Darshan Salunkhe) |

---

### Method A — Supabase CLI (recommended)

Run all migrations in one command:

```bash
cd GetNear
supabase db push
```

This applies every file in `supabase/migrations/` to your linked remote project.

**Check migration status:**

```bash
supabase migration list
```

**Reset remote database (destructive — dev only):**

```bash
supabase db reset --linked
```

---

### Method B — Run each migration individually via CLI

If you need to apply migrations one at a time:

```bash
cd GetNear

supabase db execute --file supabase/migrations/000_init_extensions_and_functions.sql
supabase db execute --file supabase/migrations/001_create_roles.sql
supabase db execute --file supabase/migrations/002_create_users.sql
supabase db execute --file supabase/migrations/003_create_restaurants.sql
supabase db execute --file supabase/migrations/004_create_restaurant_branches.sql
supabase db execute --file supabase/migrations/005_create_addresses.sql
supabase db execute --file supabase/migrations/006_create_categories.sql
supabase db execute --file supabase/migrations/007_create_products.sql
supabase db execute --file supabase/migrations/008_create_product_images.sql
supabase db execute --file supabase/migrations/009_create_cart.sql
supabase db execute --file supabase/migrations/010_create_cart_items.sql
supabase db execute --file supabase/migrations/011_create_coupons.sql
supabase db execute --file supabase/migrations/012_create_offers.sql
supabase db execute --file supabase/migrations/013_create_business_settings.sql
supabase db execute --file supabase/migrations/014_create_delivery_charges.sql
supabase db execute --file supabase/migrations/015_create_operating_hours.sql
supabase db execute --file supabase/migrations/016_create_holidays.sql
supabase db execute --file supabase/migrations/017_create_orders.sql
supabase db execute --file supabase/migrations/018_create_order_items.sql
supabase db execute --file supabase/migrations/019_create_payments.sql
supabase db execute --file supabase/migrations/020_create_coupon_usages.sql
supabase db execute --file supabase/migrations/021_create_notifications.sql
supabase db execute --file supabase/migrations/022_create_reviews.sql
supabase db execute --file supabase/migrations/023_create_favorites.sql
supabase db execute --file supabase/migrations/024_seed_admin_users.sql
```

---

### Method C — PowerShell loop (Windows)

Run all migrations in order from the `GetNear` folder:

```powershell
cd C:\Users\farin\OneDrive\Desktop\Shahan\GetNearFrontend\GetNear

Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Running: $($_.Name)" -ForegroundColor Cyan
    supabase db execute --file $_.FullName
}
```

---

### Method D — Bash loop (macOS / Linux)

```bash
cd GetNear

for file in supabase/migrations/*.sql; do
  echo "Running: $file"
  supabase db execute --file "$file"
done
```

---

### Method E — psql with connection string

Get your connection string from:

**Supabase Dashboard → Project Settings → Database → Connection string → URI**

**Windows (PowerShell):**

```powershell
cd GetNear
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

Get-ChildItem -Path "supabase\migrations\*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Running: $($_.Name)"
    psql $env:DATABASE_URL -f $_.FullName
}
```

**macOS / Linux:**

```bash
cd GetNear
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

for file in supabase/migrations/*.sql; do
  echo "Running: $file"
  psql "$DATABASE_URL" -f "$file"
done
```

---

### Method F — Supabase SQL Editor (manual)

1. Open **Supabase Dashboard → SQL Editor**
2. Click **New query**
3. Copy-paste the contents of each migration file **one at a time**
4. Run in order from `000` to `023`
5. Confirm each query succeeds before running the next

> Do **not** use the Table Editor to create tables. All schema must come from migration files.

---

## 6. Environment Variables

### Step 6.1 — Create `.env` file

**Windows (PowerShell):**

```powershell
cd GetNear
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cd GetNear
cp .env.example .env
```

### Step 6.2 — Fill in values

Edit `GetNear/.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
```

| Variable | Source |
|----------|--------|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys |

> `.env` is gitignored. Never commit secrets.

### Step 6.3 — Restart dev server after changing `.env`

Vite only reads env vars at startup. After editing `.env`:

```bash
# Stop the server (Ctrl+C), then:
npm run dev
```

---

## 7. Authentication (Phone OTP)

Customer login uses **Supabase Phone Authentication**.

### Step 7.1 — Enable Phone provider

1. Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Phone**
3. Configure an SMS provider:
   - **Twilio** (most common)
   - MessageBird, Vonage, or TextLocal

### Step 7.2 — Twilio setup (example)

1. Create account at https://twilio.com
2. Get **Account SID**, **Auth Token**, and a **Phone Number**
3. In Supabase Phone settings, enter Twilio credentials
4. Set OTP length (default: 6) and expiry

### Step 7.3 — Test phone numbers (development)

For testing without real SMS:

1. Supabase Dashboard → **Authentication** → **Phone**
2. Add test phone numbers with fixed OTP codes (Supabase test mode)

### Step 7.4 — User profile flow

After OTP login, the app must create a row in `public.users`:

```sql
-- Example: link auth user to application profile
INSERT INTO public.users (auth_user_uuid, role_id, phone, full_name)
SELECT
    'AUTH_USER_UUID_FROM_SUPABASE',
    r.id,
    '+919876543210',
    'Customer Name'
FROM public.roles r
WHERE r.slug = 'customer'
LIMIT 1;
```

The application handles this automatically once auth flows are built. For manual testing, use the SQL above in the SQL Editor.

---

## 8. Storage Buckets

Create buckets in **Supabase Dashboard → Storage → New bucket**:

| Bucket name | Public | Purpose |
|-------------|--------|---------|
| `restaurant-assets` | Yes | Restaurant logos and banners |
| `product-images` | Yes | Menu item photos |
| `user-profiles` | Yes | Customer profile avatars |

### Recommended folder structure inside buckets

```
restaurant-assets/
  logos/
  banners/

product-images/
  {restaurant_id}/
    {product_id}/

user-profiles/
  {user_id}/
```

Storage URLs are stored in `restaurants.logo_url`, `products.primary_image_url`, `product_images.image_url`, etc.

---

## 9. Razorpay Setup

### Step 9.1 — Create Razorpay account

1. Sign up at https://razorpay.com
2. Complete KYC for live mode (skip for test mode)

### Step 9.2 — Get API keys

Razorpay Dashboard → **Settings → API Keys**:

| Mode | Key prefix | Use |
|------|------------|-----|
| Test | `rzp_test_` | Development |
| Live | `rzp_live_` | Production |

Add the **Key ID** to `.env` as `VITE_RAZORPAY_KEY_ID`.

> The **Key Secret** must only be used on a secure backend (Supabase Edge Function or server). Never expose it in the frontend.

### Step 9.3 — Webhook (for production)

1. Razorpay Dashboard → **Settings → Webhooks**
2. Add endpoint URL (your backend edge function)
3. Store webhook payload in `payments.webhook_response`

Payment records are stored in the `payments` table; order references go in `orders.razorpay_order_id` and `orders.razorpay_payment_id`.

---

## 10. Seed Admin Users

Migration **`024_seed_admin_users.sql`** seeds **two admin accounts only** — no default restaurant.

| Name | Phone | Role |
|------|-------|------|
| Farine Khan | 8668879497 | admin |
| Darshan Salunkhe | 9552489313 | admin |

Apply with the rest of the migrations:

```bash
cd GetNear
supabase db push
```

Or run manually:

```bash
supabase db execute --file supabase/migrations/024_seed_admin_users.sql
```

Verify in SQL Editor:

```sql
SELECT full_name, phone, r.slug AS role
FROM public.users u
JOIN public.roles r ON r.id = u.role_id
WHERE u.deleted_at IS NULL
ORDER BY u.full_name;
```

Expected output: Farine Khan and Darshan Salunkhe with role `admin`.

### Login as admin

1. Enable **Phone** auth in Supabase (see Section 7)
2. Open the app → Login
3. Enter phone: `8668879497` or `9552489313` (with country code +91 if prompted)
4. Complete OTP verification

### Add restaurants (no SQL seed)

Restaurants are **not** seeded by default. Add them via:

- **Admin UI:** http://localhost:5173/admin/restaurants
- Or SQL when needed (after admin onboarding)

```sql
-- Example: add restaurant manually (optional)
INSERT INTO public.restaurants (name, slug, business_status, is_active)
VALUES ('Your Restaurant', 'your-restaurant', 'active', true);
```

---

## 11. Run the Application

### Development server

```bash
cd GetNear
npm run dev
```

Open the URL shown in terminal (usually http://localhost:5173).

### Production build

```bash
cd GetNear
npm run build
```

Output goes to `GetNear/dist/`.

### Preview production build locally

```bash
cd GetNear
npm run preview
```

---

## 12. Verify Setup

### Check database tables exist

In Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables (22):

```
addresses, business_settings, cart, cart_items, categories, coupon_usages,
coupons, delivery_charges, favorites, holidays, notifications, offers,
operating_hours, order_items, orders, payments, product_images, products,
restaurant_branches, restaurants, reviews, roles, users
```

### Check default roles

```sql
SELECT id, name, slug FROM public.roles ORDER BY slug;
```

Expected: `admin`, `customer`, `restaurant_owner`, `super_admin`.

### Check frontend connects to Supabase

1. Ensure `.env` is filled in
2. Run `npm run dev`
3. Open browser DevTools → Console
4. There should be **no** warning: `Missing Supabase env vars`

### Check migration history (CLI)

```bash
cd GetNear
supabase migration list
```

All 25 migrations should show as applied.

---

## 13. Useful Commands Reference

### Frontend

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### Supabase CLI

| Command | Description |
|---------|-------------|
| `supabase login` | Authenticate CLI |
| `supabase link --project-ref REF` | Link to remote project |
| `supabase db push` | Apply all pending migrations |
| `supabase migration list` | Show migration status |
| `supabase db execute --file PATH` | Run a single SQL file |
| `supabase db reset --linked` | Reset DB and re-run migrations (dev only) |
| `supabase unlink` | Unlink from remote project |

### Git

```bash
git status
git add .
git commit -m "Your message"
git push
```

---

## 14. Troubleshooting

### `supabase: command not found`

Install the CLI:

```bash
npm install -g supabase
```

Restart your terminal after install.

### `supabase link` fails

- Confirm project reference ID from Dashboard → Settings → General
- Confirm database password is correct
- Run `supabase login` again

### Migration fails mid-way

1. Read the error message in terminal or SQL Editor
2. Fix the issue (often a prior migration was skipped)
3. Re-run from the failed file onward using Method B commands
4. Do **not** use Table Editor to patch schema manually

### `Missing Supabase env vars` in browser console

- Confirm `.env` exists in `GetNear/` (not the parent folder)
- Variable names must start with `VITE_`
- Restart `npm run dev` after editing `.env`

### Phone OTP not received

- Verify Twilio/SMS provider credentials in Supabase
- Use Supabase test phone numbers in development
- Check Supabase Auth logs: Dashboard → Authentication → Logs

### Tables not visible in Supabase Table Editor

- Refresh the page
- Confirm migrations ran successfully (`supabase migration list`)
- Check SQL: `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`

### Port 5173 already in use

```bash
npm run dev -- --port 5174
```

---

## Quick Start Checklist

Use this checklist for a fresh setup:

- [ ] Install Node.js 18+ and Supabase CLI
- [ ] `cd GetNear && npm install`
- [ ] Create Supabase project
- [ ] `supabase login`
- [ ] `supabase link --project-ref YOUR_REF`
- [ ] `supabase db push` (applies all 25 migrations)
- [ ] Copy `.env.example` → `.env` and fill in keys
- [ ] Enable Phone auth in Supabase
- [ ] Create storage buckets
- [ ] Add Razorpay test key to `.env`
- [ ] Run seed SQL for first restaurant
- [ ] `npm run dev`
- [ ] Open http://localhost:5173

---

## Related Documentation

| File | Contents |
|------|----------|
| `Requirement.md` | Business requirements and table specs |
| `GetNear/supabase/DATABASE.md` | ER diagram, relationships, scalability |
| `GetNear/supabase/README.md` | Supabase quick reference |
| `GetNear/.env.example` | Environment variable template |

---

**Setup complete.** You now have a production-ready database schema, configured Supabase backend, and a running React frontend ready for feature development.
