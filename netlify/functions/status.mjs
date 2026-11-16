// GET /api/status?uid=...
// The app asks: "has this install paid?" Only the paid state and date go back, never the email.
import { validUid, json } from '../lib/payfast.mjs';
import { getSub } from '../lib/store.mjs';

export default async (req) => {
  const uid = new URL(req.url).searchParams.get('uid') || '';
  if (!validUid(uid)) return json({ error: 'bad uid' }, 400);
  const rec = await getSub(uid);
  const paidUntil = (rec && rec.paidUntil) || 0;
  return json({ active: paidUntil > Date.now(), status: (rec && rec.status) || 'none', paidUntil });
};

export const config = { path: '/api/status' };
