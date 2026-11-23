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

  const cacheKey = callsign + '|' + (searchParams.get('reg') || '');
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  // מטוסים משדרים לפעמים את המספר עם אפסים מובילים (ELY084) ולפעמים בלי (ELY84)
  const m = callsign.match(/^([A-Z]{3})(\d+)([A-Z]?)$/);
  const variants = [callsign];
  if (m && m[2].length < 3) variants.push(m[1] + m[2].padStart(3, '0') + m[3]);
  if (m && m[2].startsWith('0')) variants.push(m[1] + String(Number(m[2])) + m[3]);

  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  let ac = null;
  try {
    const urls = variants.map((v) => `https://api.adsb.lol/v2/callsign/${v}`);
    // גיבוי: חיפוש לפי מספר הרישום של המטוס, אם המטוס משדר אות קריאה אחר
    if (/^[A-Z0-9-]{3,10}$/.test(reg)) urls.push(`https://api.adsb.lol/v2/registration/${encodeURIComponent(reg)}`);
    for (const url of urls) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      ac = (data.ac || []).find((a) => typeof a.lat === 'number') || null;
      if (ac) break;
    }
  } catch {
    return NextResponse.json({ error: 'לא הצלחנו לקבל מיקום חי' }, { status: 502 });
  }

  let body = { found: false };
  if (ac) {
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
  cache.set(cacheKey, { at: Date.now(), body });
  return NextResponse.json(body);
}
