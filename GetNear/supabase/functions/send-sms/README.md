# AWS SNS SMS via Supabase Edge Function

OTP SMS is sent by the `send-sms` Edge Function using **AWS SNS**.  
Secrets live in **Supabase project secrets** — never in the Vite frontend.

> If you previously pasted AWS keys in chat, **rotate them in IAM first**, then set the new keys below.

## 1. Deploy the function

```powershell
cd GetNear
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# IMPORTANT: Auth hooks must call the function without JWT verification
supabase functions deploy send-sms --no-verify-jwt
```

Function URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-sms
```

## 2. Set secrets (Supabase CLI)

```powershell
supabase secrets set AWS_ACCESS_KEY_ID=YOUR_NEW_ACCESS_KEY
supabase secrets set AWS_SECRET_ACCESS_KEY=YOUR_NEW_SECRET_KEY
supabase secrets set AWS_REGION=ap-south-1
```

Optional (alphanumeric Sender ID where AWS/your country supports it):

```powershell
supabase secrets set SMS_SENDER_ID=GetNear
```

Or in Dashboard: **Project Settings → Edge Functions → Secrets**.

## 3. Enable Send SMS Auth Hook

1. Supabase Dashboard → **Authentication → Hooks** (or Auth → Hooks)
2. Enable **Send SMS**
3. Set HTTPS URL to:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-sms`
4. Copy the generated **Hook Secret** (looks like `v1,whsec_...`)
5. Save it as an Edge Function secret:

```powershell
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_YOUR_SECRET_HERE"
```

Redeploy after setting secrets if needed:

```powershell
supabase functions deploy send-sms --no-verify-jwt
```

## 4. Enable Phone provider

**Authentication → Providers → Phone** → enable.

With the Send SMS hook enabled, Supabase will generate the OTP and call your function instead of Twilio.

## 5. AWS SNS checklist

In AWS:

1. IAM user/role with permission `sns:Publish` (SMS)
2. Region supports SMS (e.g. `ap-south-1` for India)
3. For India: complete SNS SMS sandbox / production registration as required by AWS
4. Spend limit / SMS preferences configured in SNS console

Minimal IAM policy example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": ["*"]
    }
  ]
}
```

## 6. Test

```powershell
cd GetNear
npm run dev
```

Open `http://localhost:5173/admin/log-in` → enter admin mobile → you should receive an SMS from SNS.

### Debug

```powershell
supabase functions logs send-sms --follow
```

Common errors:

| Error | Fix |
|-------|-----|
| Hook secret not configured | Set `SEND_SMS_HOOK_SECRET` |
| Missing AWS keys | Set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| SNS Publish failed | Check region, IAM, SMS sandbox, phone E.164 (`+91…`) |
| Unauthorized / verify failed | Hook secret must match Dashboard value exactly |

## Security

- Never put AWS keys in `GetNear/.env` or any `VITE_*` variable
- Never commit secrets to git
- Rotate keys if they were shared in chat or committed by mistake
