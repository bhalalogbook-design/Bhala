// GET /api/admin  (header x-admin-key: <ADMIN_KEY>)
// Subscriber list and money totals for the two partners. Needs the ADMIN_KEY setting.
import crypto from 'node:crypto';
import { config as pfConfig, json } from '../lib/payfast.mjs';
import { allSubs } from '../lib/store.mjs';

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async (req) => {
  const cfg = pfConfig();
  const key = req.headers.get('x-admin-key') || '';
  if (!cfg.adminKey || cfg.adminKey.length < 12) return json({ error: 'Set an ADMIN_KEY of at least 12 characters in Netlify first.' }, 503);
  if (!same(key, cfg.adminKey)) return json({ error: 'Wrong admin key' }, 401);

  const now = Date.now();
  const subs = (await allSubs()).sort((a, b) => (b.lastPaymentAt || 0) - (a.lastPaymentAt || 0));
  const rows = subs.map((s) => ({
    name: s.name || '',
    email: s.email || '',
    status: (s.paidUntil || 0) > now ? (s.status === 'cancelled' ? 'paid, cancelled' : 'active') : (s.status === 'cancelled' ? 'cancelled' : 'lapsed'),
    paidUntil: s.paidUntil || 0,
    payments: s.payments || 0,
    totalGross: s.totalGross || 0,
    totalNet: s.totalNet || 0,
  }));
  const sum = (k) => Math.round(rows.reduce((a, r) => a + r[k], 0) * 100) / 100;
  return json({
    mode: cfg.sandbox ? 'Test' : 'Live',
    price: cfg.price,
    active: rows.filter((r) => r.paidUntil > now).length,
    totalGross: sum('totalGross'),
    totalNet: sum('totalNet'),
    rows,
  });
};

export const config = { path: '/api/admin' };
