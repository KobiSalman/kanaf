import { NextResponse } from 'next/server';
import { windowView, placeAt } from '../../../lib/geo';

// מיקום חי בזמן אמת מרשת ה-ADS-B הקהילתית adsb.lol (חינם, בלי מפתח).
// מטמון של 10 שניות כדי לא להעמיס על השירות.
const cache = new Map();
const TTL_MS = 10 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const callsign = (searchParams.get('callsign') || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{3}\d{1,4}[A-Z]?$/.test(callsign)) {
    return NextResponse.json({ error: 'אות קריאה לא תקין' }, { status: 400 });
  }

  const hit = cache.get(callsign);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  let data;
  try {
    const res = await fetch(`https://api.adsb.lol/v2/callsign/${callsign}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'לא הצלחנו לקבל מיקום חי' }, { status: 502 });
  }

  const ac = (data.ac || [])[0];
  let body = { found: false };
  if (ac && typeof ac.lat === 'number') {
    const onGround = ac.alt_baro === 'ground';
    const altFt = onGround ? 0 : Number(ac.alt_baro) || 0;
    const seenMs = Math.round((ac.seen_pos ?? ac.seen ?? 0) * 1000);
    body = {
      found: true,
      registration: ac.r || null,
      type: ac.t || null,
      live: {
        updated: new Date(Date.now() - seenMs).toISOString(),
        latitude: ac.lat,
        longitude: ac.lon,
        altitudeM: altFt * 0.3048,
        speedKmh: (ac.gs || 0) * 1.852,
        verticalKmh: (ac.baro_rate || 0) * 0.018288,
        direction: ac.track ?? 0,
        isGround: onGround,
        outsideC: typeof ac.oat === 'number' ? ac.oat : null
      }
    };
    try {
      body.view = onGround
        ? { over: placeAt(ac.lat, ac.lon), left: null, right: null }
        : windowView(body.live);
    } catch {
      body.view = null;
    }
  }
  cache.set(callsign, { at: Date.now(), body });
  return NextResponse.json(body);
}
