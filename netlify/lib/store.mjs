// Subscriber records live in Netlify Blobs (free key-value storage that comes with every Netlify site).
// One record per app install, keyed by the random id the app makes. No logbook data is ever stored here.
import { getStore } from '@netlify/blobs';

function store() {
  return getStore({ name: 'subscribers', consistency: 'strong' });
}

export async function getSub(uid) {
  return (await store().get(uid, { type: 'json' })) || null;
}

export async function putSub(uid, rec) {
  await store().setJSON(uid, rec);
}

export async function allSubs() {
  const s = store();
  const { blobs } = await s.list();
  const out = [];
  for (const b of blobs) {
    const rec = await s.get(b.key, { type: 'json' });
    if (rec) out.push(rec);
  }
  return out;
}
