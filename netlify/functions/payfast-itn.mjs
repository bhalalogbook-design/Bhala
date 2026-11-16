// POST /api/payfast-itn
// PayFast calls this after every payment and when a subscription is cancelled (the "ITN").
// It runs PayFast's four checks, then marks that app install as paid.
import { config as pfConfig, itnSignatureOk, itnParamString, ipIsPayFast, confirmWithPayFast, validUid } from '../lib/payfast.mjs';
import { getSub, putSub } from '../lib/store.mjs';

const DAY = 86400000;

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const cfg = pfConfig();
  const raw = await req.text();
  const pairs = [...new URLSearchParams(raw)];
  const get = (k) => (pairs.find(([key]) => key === k) || [])[1] || '';

  // 1. Signature matches (proves the data wasn't changed on the way).
  if (!itnSignatureOk(pairs, cfg.passphrase)) {
    console.warn('ITN rejected: bad signature');
    return new Response('Bad signature', { status: 400 });
  }
  // 2. It came from a PayFast server.
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (!cfg.skipIpCheck && !(await ipIsPayFast(ip))) {
    console.warn('ITN rejected: not from PayFast', ip);
    return new Response('Unknown source', { status: 403 });
  }
  // 3. It's for this shop and for an amount we sell.
  const gross = Number(get('amount_gross'));
  if (get('merchant_id') !== cfg.merchantId || !cfg.acceptedAmounts.some((a) => Math.abs(a - gross) < 0.01)) {
    console.warn('ITN rejected: wrong merchant or amount', get('merchant_id'), gross);
    return new Response('Wrong merchant or amount', { status: 400 });
  }
  // 4. PayFast confirms it's genuine.
  if (!(await confirmWithPayFast(itnParamString(pairs), cfg.host))) {
    console.warn('ITN rejected: PayFast did not confirm');
    return new Response('Not confirmed', { status: 400 });
  }

  const uid = get('custom_str1');
  if (!validUid(uid)) return new Response('OK', { status: 200 }); // valid payment, but not from the app; nothing to unlock

  const now = Date.now();
  const status = get('payment_status');
  const pfId = get('pf_payment_id');
  const rec = (await getSub(uid)) || { uid, createdAt: now, payments: 0, totalGross: 0, totalNet: 0, pfIds: [] };
  rec.email = get('email_address') || rec.email || '';
  rec.name = get('name_first') || rec.name || '';
  rec.token = get('token') || rec.token || '';
  rec.updatedAt = now;

  if (status === 'COMPLETE') {
    if (!rec.pfIds.includes(pfId)) {
      // a retried ITN must not be counted twice
      rec.payments += 1;
      rec.totalGross = Math.round((rec.totalGross + gross) * 100) / 100;
      rec.totalNet = Math.round((rec.totalNet + Number(get('amount_net') || 0)) * 100) / 100;
      rec.pfIds = rec.pfIds.concat(pfId).slice(-24);
      rec.lastPaymentAt = now;
      rec.paidUntil = now + cfg.daysPerPayment * DAY; // each monthly payment covers the next 35 days
    }
    rec.status = 'active';
  } else if (status === 'CANCELLED') {
    rec.status = 'cancelled'; // they keep access until paidUntil
  } else {
    rec.lastStatus = status;
  }
  await putSub(uid, rec);
  return new Response('OK', { status: 200 });
};

export const config = { path: '/api/payfast-itn' };
