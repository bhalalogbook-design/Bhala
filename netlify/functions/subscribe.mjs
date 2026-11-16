// GET /api/subscribe?uid=...&email=...&name=...
// Builds a signed PayFast recurring-billing form and sends the apprentice straight to PayFast's secure page.
import { config as pfConfig, formSignature, validUid } from '../lib/payfast.mjs';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function page(title, body, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;color:#14202E;background:#F3F5F8;text-align:center}` +
      `button,a.btn{display:inline-block;margin-top:16px;padding:14px 22px;border:0;border-radius:12px;background:#F26B1D;color:#0E2A47;font-weight:700;font-size:16px;text-decoration:none}</style></head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

export default async (req) => {
  const cfg = pfConfig();
  const url = new URL(req.url);
  const uid = url.searchParams.get('uid') || '';
  const email = (url.searchParams.get('email') || '').trim().slice(0, 100);
  const name = (url.searchParams.get('name') || '').trim().split(/\s+/)[0].slice(0, 100);

  if (!validUid(uid) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return page('Bhala', '<h1>Something is missing</h1><p>Go back to Bhala and try Subscribe again.</p><a class="btn" href="/app/">Back to Bhala</a>', 400);
  }
  if (!cfg.merchantId || !cfg.merchantKey || !cfg.passphrase) {
    return page('Bhala', '<h1>Payments aren’t set up yet</h1><p>The PayFast settings are missing on this site.</p><a class="btn" href="/app/">Back to Bhala</a>', 503);
  }

  const site = url.origin;
  const amount = cfg.price.toFixed(2);
  // Order matters: PayFast checks the signature in this field order.
  const fields = [
    ['merchant_id', cfg.merchantId],
    ['merchant_key', cfg.merchantKey],
    ['return_url', `${site}/app/?paid=1`],
    ['cancel_url', `${site}/app/?paid=0`],
    ['notify_url', `${site}/api/payfast-itn`],
    ['name_first', name],
    ['email_address', email],
    ['m_payment_id', `${uid}-${Date.now()}`],
    ['amount', amount],
    ['item_name', cfg.itemName],
    ['custom_str1', uid],
    ['subscription_type', '1'],
    ['recurring_amount', amount],
    ['frequency', '3'], // 3 = monthly
    ['cycles', '0'], // 0 = until cancelled
  ].filter(([, v]) => String(v).trim() !== '');
  const signature = formSignature(fields, cfg.passphrase);

  const inputs = fields.concat([['signature', signature]])
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(String(v).trim())}">`)
    .join('');
  return page(
    'Going to PayFast',
    `<h1>Taking you to PayFast…</h1><p>R${esc(amount)} a month. Cancel any time.</p>` +
      `<form id="pf" action="${cfg.host}/eng/process" method="post">${inputs}<button type="submit">Continue to PayFast</button></form>` +
      `<script>document.getElementById('pf').submit();</script>`
  );
};

export const config = { path: '/api/subscribe' };
