# Supabase connection (GetNear)

## 1. Create `.env` in this folder

```powershell
cd GetNear
Copy-Item .env.example .env
```

In Supabase Dashboard → **Project Settings → API**:

| Env var | Copy this |
|---------|-----------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | **anon** / **publishable** key |

Do **not** put `service_role` or `sb_secret_…` in the frontend.

## 2. Apply migrations (000 → 026)

```powershell
cd GetNear
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or run SQL files in order in the SQL Editor.

New migrations for this integration:

- `025_restaurant_display_fields_and_rls.sql`
- `026_fix_phone_link_policy.sql`

## 3. Enable Phone Auth

Dashboard → **Authentication → Providers → Phone** → enable.

For local testing without SMS cost, use **Authentication → Phone → Test phone numbers**.

## 4. Seeded admins (migration 024)

| Name | Phone |
|------|-------|
| Farine Khan | 8668879497 |
| Darshan Salunkhe | 9552489313 |

Login: http://localhost:5173/admin/log-in → OTP → `/admin`

## 5. Run app

```powershell
npm install
npm run dev
```

Restaurants and products now load/save from Supabase (no localStorage catalog).

## 6. SMS OTP via AWS SNS (Edge Function)

See [`supabase/functions/send-sms/README.md`](./supabase/functions/send-sms/README.md).

Summary:

```powershell
supabase functions deploy send-sms --no-verify-jwt
supabase secrets set AWS_ACCESS_KEY_ID=...
supabase secrets set AWS_SECRET_ACCESS_KEY=...
supabase secrets set AWS_REGION=ap-south-1
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..."
```

Then enable **Authentication → Hooks → Send SMS** pointing at:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-sms`

**Never** put AWS SNS keys in the Vite frontend `.env`.
