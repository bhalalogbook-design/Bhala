// Mentor sign-off by link: /api/sign
// The app stores one month's summary (days, hours, work, codes; no photos) under a random link code.
// The mentor opens /sign/?t=CODE, checks the days and signs. The app collects the signature, then the record is deleted.
// Records that are never collected are removed after 45 days.
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { validUid, json } from '../lib/payfast.mjs';

const DAYS_KEPT = 45;
const store = () => getStore({ name: 'signoffs', consistency: 'strong' });
const okToken = (t) => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

function cleanPacket(p) {
  if (!p || typeof p !== 'object' || !/^\d{4}-\d{2}$/.test(p.month) || !Array.isArray(p.days) || !p.days.length || p.days.length > 62) return null;
  return {
    v: 1, month: p.month, monthLabel: clip(p.monthLabel, 40), trade: clip(p.trade, 80), qual: clip(p.qual, 200),
    apprentice: clip(p.apprentice, 120), studentNo: clip(p.studentNo, 60), employer: clip(p.employer, 160), college: clip(p.college, 160), mentor: clip(p.mentor, 80),
    days: p.days.map((d) => ({
      date: clip(d && d.date, 10), label: clip(d && d.label, 24), time: clip(d && d.time, 24),
      h: Math.max(0, Math.min(24, Number(d && d.h) || 0)), work: clip(d && d.work, 600), code: clip(d && d.code, 24), level: clip(d && d.level, 60),
    })),
  };
}

async function load(t) {
  const rec = await store().get(t, { type: 'json' });
  if (!rec) return null;
  if (Date.now() - (rec.createdAt || 0) > DAYS_KEPT * 86400000) { await store().delete(t); return null; }
  return rec;
}

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const t = url.searchParams.get('t') || '';
    if (!okToken(t)) return json({ error: 'bad link' }, 400);
    const rec = await load(t);
    if (!rec) return json({ error: 'not found' }, 404);
    if (url.searchParams.get('result')) {
      if (url.searchParams.get('uid') !== rec.uid) return json({ error: 'not yours' }, 403);
      return json({ signed: rec.signed || null });
    }
    return json({ packet: rec.packet, signed: rec.signed ? { name: rec.signed.name, at: rec.signed.at } : null });
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const raw = await req.text();
  if (raw.length > 400000) return json({ error: 'too big' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  const action = body && body.action;

  if (action === 'create') {
    if (!validUid(body.uid)) return json({ error: 'bad uid' }, 400);
    const packet = cleanPacket(body.packet);
    if (!packet) return json({ error: 'bad packet' }, 400);
    const t = crypto.randomBytes(16).toString('hex');
    await store().setJSON(t, { createdAt: Date.now(), uid: body.uid, packet, signed: null });
    return json({ token: t });
  }
  if (action === 'sign') {
    if (!okToken(body.t)) return json({ error: 'bad link' }, 400);
    const rec = await load(body.t);
    if (!rec) return json({ error: 'not found' }, 404);
    if (rec.signed) return json({ error: 'already signed', signed: { name: rec.signed.name, at: rec.signed.at } }, 409);
    const name = clip(body.name, 80).trim();
    const png = String(body.png || '');
    if (!name || body.agree !== true) return json({ error: 'name and confirmation needed' }, 400);
    if (png.length > 300000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png)) return json({ error: 'bad signature' }, 400);
    rec.signed = { name, png, at: Date.now() };
    await store().setJSON(body.t, rec);
    return json({ ok: true });
  }
  if (action === 'done') {
    if (!okToken(body.t)) return json({ error: 'bad link' }, 400);
    const rec = await store().get(body.t, { type: 'json' });
    if (rec && rec.uid === body.uid) await store().delete(body.t);
    return json({ ok: true });
  }
  return json({ error: 'unknown action' }, 400);
};

export const config = { path: '/api/sign' };
