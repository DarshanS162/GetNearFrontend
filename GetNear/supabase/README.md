# Supabase Setup — GetNear

## Prerequisites

- [Supabase](https://supabase.com) project created
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for `db push`)

## 1. Apply Database Migrations

See [DATABASE.md](./DATABASE.md) for full schema documentation.

```bash
cd GetNear
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or run all 25 SQL files manually in the Supabase SQL Editor (000 → 024).

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

Two admins are seeded automatically — **no default restaurant**:

| Name | Phone |
|------|-------|
| Farine Khan | 8668879497 |
| Darshan Salunkhe | 9552489313 |

Add restaurants via Admin UI at `/admin/restaurants` after login.
