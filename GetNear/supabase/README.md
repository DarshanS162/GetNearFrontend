# Supabase Setup — GetNear

## Prerequisites

- [Supabase](https://supabase.com) project created
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for `db push`)

## 1. Apply Database Migrations

See [DATABASE.md](./DATABASE.md) for full schema documentation.

### Reset + apply (SQL Editor — recommended)

In **Supabase Dashboard → SQL Editor**, run in order:

1. `RESET_DATABASE.sql` — wipes `public` schema + clears seeded admin auth users  
2. `APPLY_ALL_MIGRATIONS.sql` — creates everything 000→026 (admins + table grants)

### CLI (optional)

```bash
cd GetNear
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## 2. Enable Phone Auth

In Supabase Dashboard → Authentication → Providers:

1. Enable **Phone** provider
2. Configure SMS provider (Twilio, MessageBird, etc.)
3. Set OTP expiry and rate limits

## 3. Environment Variables

Copy `.env.example` to `.env` in the `GetNear` folder:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_RAZORPAY_KEY_ID=your_razorpay_key
```

## 4. Storage Buckets (manual setup)

Create these buckets in Supabase Storage:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `restaurant-assets` | Yes | Logos, banners |
| `product-images` | Yes | Menu item photos |
| `user-profiles` | Yes | Profile avatars |

## 5. Admin users (migration 024)

Admins use **phone + password** in the UI (no OTP). Under the hood Auth uses email `{phone}@admin.getnear.app`.

| Name | Phone | Password |
|------|-------|----------|
| Farine Khan | 8668879497 | `GetNear@123` |
| Darshan Salunkhe | 9552489313 | `GetNear@123` |

Login at `/admin/log-in`.
