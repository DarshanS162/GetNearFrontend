/**
 * Supabase Auth Hook: Send SMS via AWS SNS
 *
 * Secrets (set in Supabase — never in the frontend):
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION              (e.g. ap-south-1)
 *   SEND_SMS_HOOK_SECRET   (from Dashboard Auth Hook — format v1,whsec_...)
 *   SMS_SENDER_ID          (optional alphanumeric sender ID where supported)
 *
 * Deploy:
 *   supabase functions deploy send-sms --no-verify-jwt
 *
 * Configure Auth Hook URI:
 *   https://<PROJECT_REF>.supabase.co/functions/v1/send-sms
 */

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

type SendSmsPayload = {
  user: { phone?: string; id?: string };
  sms: { otp?: string };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeHookSecret(raw: string): string {
  // Supabase stores secrets as: v1,whsec_<base64>
  return raw.replace(/^v1,/, '').replace(/^whsec_/, '');
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return `+${digits}`;
  // Default India if 10-digit local number
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

async function publishSnsSms(phoneE164: string, message: string) {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = Deno.env.get('AWS_REGION') || 'ap-south-1';
  const senderId = Deno.env.get('SMS_SENDER_ID');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY secrets');
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    region,
    service: 'sns',
  });

  const params = new URLSearchParams({
    Action: 'Publish',
    Version: '2010-03-31',
    PhoneNumber: phoneE164,
    Message: message,
    'MessageAttributes.entry.1.Name': 'AWS.SNS.SMS.SMSType',
    'MessageAttributes.entry.1.Value.DataType': 'String',
    'MessageAttributes.entry.1.Value.StringValue': 'Transactional',
  });

  if (senderId) {
    params.set('MessageAttributes.entry.2.Name', 'AWS.SNS.SMS.SenderID');
    params.set('MessageAttributes.entry.2.Value.DataType', 'String');
    params.set('MessageAttributes.entry.2.Value.StringValue', senderId);
  }

  const endpoint = `https://sns.${region}.amazonaws.com/`;
  const response = await aws.fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SNS Publish failed (${response.status}): ${text}`);
  }
  return text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET');
    if (!hookSecret) {
      console.error('SEND_SMS_HOOK_SECRET is not set');
      return jsonResponse({ error: 'Hook secret not configured' }, 500);
    }

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(normalizeHookSecret(hookSecret));

    const verified = wh.verify(payload, headers) as SendSmsPayload;
    const phone = verified?.user?.phone;
    const otp = verified?.sms?.otp;

    if (!phone || !otp) {
      return jsonResponse({ error: 'Missing phone or OTP in hook payload' }, 400);
    }

    const phoneE164 = toE164(phone);
    const message = `GetNear: Your login code is ${otp}. Valid for a few minutes. Do not share this code.`;

    await publishSnsSms(phoneE164, message);

    return jsonResponse({});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-sms hook error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
