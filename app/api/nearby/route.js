import { NextResponse } from 'next/server';
import { airlineOf, compass } from '../../../lib/aviation';
import { adsbFetch } from '../../../lib/adsb';
import { cachedFetch, cdnHeaders, noStore, RateLimited } from '../../../lib/cache';

// "מה טס מעליי": כל המטוסים ברדיוס של כ-46 ק״מ, בזמן אמת מ-adsb.lol, דרך המטמון המשותף.
const RADIUS_NM = 25;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'מיקום לא תקין' }, { status: 400, headers: noStore });
  }
  // עיגול המיקום לכ-2 ק״מ: גם פרטיות וגם מטמון משותף לשכנים
  const rl = Math.round(lat * 50) / 50, ro = Math.round(lon * 50) / 50;
  let r;
  try {
    r = await cachedFetch(`nearby:${rl},${ro}`, { freshMs: 15000, keepSeconds: 300, source: 'adsb' }, async () => {
      const data = await adsbFetch(`/v2/point/${rl}/${ro}/${RADIUS_NM}`);
      return buildBody(data);
    });
  } catch (e) {
    const busy = e instanceof RateLimited;
    return NextResponse.json({ error: busy ? 'שירות המיקום החי עמוס כרגע. ננסה שוב בעוד רגע.' : 'לא הצלחנו לקבל את המטוסים באזור. נסה שוב בעוד רגע.', busy },
      { status: busy ? 503 : 502, headers: noStore });
  }
  return NextResponse.json({ ...r.value, stale: r.stale }, { headers: cdnHeaders(15, 30) });
}

function buildBody(data) {
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

  return { radiusKm: Math.round(RADIUS_NM * 1.852), planes, at: new Date().toISOString() };
}
