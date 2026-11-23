import { NextResponse } from 'next/server';
import { airlineOf, compass } from '../../../lib/aviation';

// "מה טס מעליי": כל המטוסים ברדיוס של כ-45 ק״מ, בזמן אמת מ-adsb.lol.
const cache = new Map();
const TTL_MS = 15 * 1000;
const RADIUS_NM = 25;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'מיקום לא תקין' }, { status: 400 });
  }
  // עיגול המיקום: גם פרטיות וגם מטמון משותף לשכנים
  const rl = Math.round(lat * 100) / 100, ro = Math.round(lon * 100) / 100;
  const key = `${rl},${ro}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  let data;
  try {
    const res = await fetch(`https://api.adsb.lol/v2/point/${rl}/${ro}/${RADIUS_NM}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'לא הצלחנו לקבל את המטוסים באזור. נסה שוב בעוד רגע.' }, { status: 502 });
  }

  const planes = (data.ac || [])
    .filter((a) => typeof a.lat === 'number')
    .map((a) => {
      const raw = (a.flight || '').trim();
      const callsign = /^[A-Z0-9]{2,8}$/.test(raw) ? raw : null;
      const onGround = a.alt_baro === 'ground';
      return {
        id: a.hex,
        callsign,
        airline: airlineOf(callsign),
        registration: a.r || null,
        type: a.t || null,
        altFt: onGround ? 0 : Number(a.alt_baro) || 0,
        onGround,
        speedKmh: Math.round((a.gs || 0) * 1.852),
        verticalFpm: a.baro_rate ?? a.geom_rate ?? 0,
        distKm: Math.round((a.dst || 0) * 1.852 * 10) / 10,
        fromYou: a.dir != null ? compass(a.dir) : null,
        heading: a.track != null ? compass(a.track) : null
      };
    })
    .sort((x, y) => x.distKm - y.distKm)
    .slice(0, 25);

  const body = { radiusKm: Math.round(RADIUS_NM * 1.852), planes, at: new Date().toISOString() };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
