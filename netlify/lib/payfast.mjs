// Shared PayFast helpers for the Bhala functions.
// Settings come from Netlify environment variables (Site configuration > Environment variables).
import crypto from 'node:crypto';
import dns from 'node:dns';

// PayFast's published sandbox details for testing recurring billing (payfast.kayako.com, article 149)
const SANDBOX_DEFAULTS = { merchantId: '10004002', merchantKey: 'q1cd2rdny4a53', passphrase: 'payfast' };

export function config() {
  const env = process.env;
  const sandbox = String(env.PAYFAST_SANDBOX ?? 'true').toLowerCase() !== 'false';
  const price = Number(env.PRICE || '29');
  return {
    sandbox,
    merchantId: env.PAYFAST_MERCHANT_ID || (sandbox ? SANDBOX_DEFAULTS.merchantId : ''),
    merchantKey: env.PAYFAST_MERCHANT_KEY || (sandbox ? SANDBOX_DEFAULTS.merchantKey : ''),
    passphrase: env.PAYFAST_PASSPHRASE || (sandbox ? SANDBOX_DEFAULTS.passphrase : ''),
    price,
    acceptedAmounts: [price].concat(String(env.PAYFAST_ACCEPTED_AMOUNTS || '').split(',').map(Number).filter((n) => n > 0)),
    itemName: env.ITEM_NAME || 'Bhala monthly subscription',
    adminKey: env.ADMIN_KEY || '',
    skipIpCheck: String(env.PAYFAST_SKIP_IP_CHECK || '').toLowerCase() === 'true',
    host: sandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za',
    daysPerPayment: Number(env.DAYS_PER_PAYMENT || '35'), // a month plus a few days' grace
  };
}

// PHP-style urlencode, which PayFast uses for signatures: spaces become '+', and !'()*~ are percent-encoded.
export function pfEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

export function md5(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

// Signature for the payment form: fields in the order sent, blanks skipped, values trimmed, passphrase last.
export function formSignature(fields, passphrase) {
  let s = fields
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`)
    .join('&');
  if (passphrase) s += `&passphrase=${pfEncode(passphrase.trim())}`;
  return md5(s);
}

// ITN parameter string: every posted field before 'signature', in order, as PayFast's own sample builds it.
export function itnParamString(pairs) {
  const out = [];
  for (const [k, v] of pairs) {
    if (k === 'signature') break;
    out.push(`${k}=${pfEncode(v)}`);
  }
  return out.join('&');
}

export function itnSignatureOk(pairs, passphrase) {
  const given = (pairs.find(([k]) => k === 'signature') || [])[1] || '';
  let s = itnParamString(pairs);
  if (passphrase) s += `&passphrase=${pfEncode(passphrase.trim())}`;
  return given.length === 32 && md5(s) === given.toLowerCase();
}

const PF_HOSTS = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];
// PayFast's published server IP ranges (developers.payfast.co.za/docs#ports-ips, checked 18 Nov 2026).
// If PayFast adds more, put them in the PAYFAST_EXTRA_IPS setting in Netlify, comma-separated (for example 1.2.3.0/28).
const PF_RANGES = ['197.97.145.144/28', '41.74.179.192/27', '102.216.36.0/28', '102.216.36.128/28', '144.126.193.139/32'];

function ipToInt(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function ipInRanges(ip, ranges) {
  const n = ipToInt(ip);
  if (n === null) return false;
  return ranges.some((r) => {
    const [base, bits = '32'] = String(r).trim().split('/');
    const b = ipToInt(base); const len = Number(bits);
    if (b === null || !(len >= 0 && len <= 32)) return false;
    const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

export async function ipIsPayFast(ip, resolver = dns.promises.resolve4, extra = process.env.PAYFAST_EXTRA_IPS || '') {
  if (!ip) return false;
  ip = String(ip).trim().replace(/^::ffff:/i, '');
  const ranges = PF_RANGES.concat(String(extra).split(',').map((x) => x.trim()).filter(Boolean));
  if (ipInRanges(ip, ranges)) return true;
  const lists = await Promise.all(PF_HOSTS.map((h) => resolver(h).catch(() => [])));
  return lists.flat().includes(ip);
}

// Ask PayFast to confirm the ITN data is genuine. Returns true only for the reply "VALID".
export async function confirmWithPayFast(paramString, host, fetchImpl = fetch) {
  const res = await fetchImpl(`${host}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: paramString,
  });
  const text = (await res.text()).trim();
  return res.ok && text === 'VALID';
}

export function validUid(uid) {
  return typeof uid === 'string' && /^[a-z0-9-]{8,64}$/.test(uid);
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
