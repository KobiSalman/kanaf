import { NextResponse } from 'next/server';
import { lookupLive, CALLSIGN_RE } from '../../../lib/adsb';

// מיקום חי בזמן אמת מרשת ה-ADS-B הקהילתית adsb.lol (חינם, בלי מפתח).
// מטמון של 10 שניות כדי לא להעמיס על השירות.
const cache = new Map();
const TTL_MS = 10 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const callsign = (searchParams.get('callsign') || '').replace(/\s+/g, '').toUpperCase();
  if (!CALLSIGN_RE.test(callsign)) {
    return NextResponse.json({ error: 'אות קריאה לא תקין' }, { status: 400 });
  }
  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  const alt = (searchParams.get('alt') || '').trim().toUpperCase();
  const from = (searchParams.get('from') || '').trim().toUpperCase();
  const to = (searchParams.get('to') || '').trim().toUpperCase();
  const direction = searchParams.get('dir') === 'arrival' ? 'arrival' : 'departure';
  const etaMs = Number(searchParams.get('eta')) || null;
  const cacheKey = [callsign, reg, alt, from, to].join('|');
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  let body;
  try {
    body = await lookupLive({ callsign, reg, alt, from, to, direction, etaMs });
  } catch {
    return NextResponse.json({ error: 'לא הצלחנו לקבל מיקום חי' }, { status: 502 });
  }
  cache.set(cacheKey, { at: Date.now(), body });
  return NextResponse.json(body);
}
