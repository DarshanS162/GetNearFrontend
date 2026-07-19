/**
 * Admin alerts when a restaurant applies via /partner.
 *
 * Priority:
 * 1) Web3Forms — set VITE_WEB3FORMS_ACCESS_KEY (free: https://web3forms.com)
 * 2) FormSubmit — no key; each inbox must click Activate once (check Spam)
 */
const ADMIN_EMAILS = [
  'farinepkhan520@gmail.com',
  'darshan.d.salunkhe@gmail.com',
];

function buildMessage(details) {
  return [
    'New restaurant partner application on GetNear.',
    '',
    `Restaurant: ${details.restaurantName || '—'}`,
    `Owner: ${details.ownerName || '—'}`,
    `Phone: ${details.phone ? `+91 ${details.phone}` : '—'}`,
    `Location: ${details.location || '—'}`,
    `Cuisine: ${details.cuisine || '—'}`,
    `Contact email: ${details.contactEmail || '—'}`,
    `GST: ${details.gstNumber || '—'}`,
    `FSSAI: ${details.fssaiNumber || '—'}`,
    `Description: ${details.description || '—'}`,
    '',
    'Status: Pending approval (inactive until you verify in Admin → Applications).',
  ].join('\n');
}

async function sendViaWeb3Forms(details) {
  const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;
  if (!accessKey) return null;

  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: accessKey,
      subject: `GetNear: New partner — ${details.restaurantName || 'Restaurant'}`,
      from_name: 'GetNear Partner',
      name: details.ownerName || 'Partner applicant',
      email: details.contactEmail || 'noreply@getnear.app',
      phone: details.phone ? `+91 ${details.phone}` : '',
      message: buildMessage(details),
      to: ADMIN_EMAILS.join(', '),
      restaurant: details.restaurantName || '',
      location: details.location || '',
      cuisine: details.cuisine || '',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Web3Forms failed (${res.status})`);
  }
  return { provider: 'web3forms', sent: ADMIN_EMAILS.length };
}

async function sendViaFormSubmit(email, details) {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: details.ownerName || 'Partner applicant',
      email: details.contactEmail || 'noreply@getnear.app',
      message: buildMessage(details),
      _subject: `GetNear: New partner — ${details.restaurantName || 'Restaurant'}`,
      _template: 'table',
      _replyto: details.contactEmail || undefined,
      Restaurant: details.restaurantName || '—',
      Owner: details.ownerName || '—',
      Phone: details.phone ? `+91 ${details.phone}` : '—',
      Location: details.location || '—',
      Cuisine: details.cuisine || '—',
      GST: details.gstNumber || '—',
      FSSAI: details.fssaiNumber || '—',
    }),
  });

  const data = await res.json().catch(() => ({}));
  const success = data.success === true || data.success === 'true';
  if (!res.ok || !success) {
    throw new Error(
      data.message || `FormSubmit to ${email} failed (${res.status})`,
    );
  }
}

/**
 * Notify admins of a new partner application.
 * Never throws — registration must succeed even if mail fails.
 */
export async function notifyAdminsOfPartnerApplication(details) {
  try {
    const viaWeb3 = await sendViaWeb3Forms(details);
    if (viaWeb3) return viaWeb3;
  } catch (err) {
    console.warn('[GetNear] Web3Forms notify failed, trying FormSubmit:', err?.message || err);
  }

  const results = await Promise.allSettled(
    ADMIN_EMAILS.map((email) => sendViaFormSubmit(email, details)),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    console.warn(
      '[GetNear] Partner email notify failed:',
      failed.map((r) => r.reason?.message || r.reason),
    );
    console.warn(
      '[GetNear] Tip: Check Spam for FormSubmit “Activate Form” mail, OR set VITE_WEB3FORMS_ACCESS_KEY from https://web3forms.com',
    );
  }

  return {
    provider: 'formsubmit',
    sent: results.length - failed.length,
    failed: failed.length,
  };
}
