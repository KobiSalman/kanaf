import { NextResponse } from 'next/server';
import { airlineOf, compass } from '../../../lib/aviation';
import { adsbFetch } from '../../../lib/adsb';
import { cachedFetch, cdnHeaders, noStore, RateLimited } from '../../../lib/cache';
import { fullBoard, parseFlight, titleCase } from '../../../lib/iaa';
import { localToInstant } from '../../../lib/time';
import { tOf } from '../../../lib/i18nServer';

// "מה טס מעליי": כל המטוסים ברדיוס של כ-46 ק״מ, בזמן אמת מ-adsb.lol, דרך המטמון המשותף.
const RADIUS_NM = 25;

export async function GET(request) {
  const t = tOf(request);
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: t('מיקום לא תקין') }, { status: 400, headers: noStore });
  }
  // עיגול המיקום לכ-2 ק״מ: גם פרטיות וגם מטמון משותף לשכנים
  const rl = Math.round(lat * 50) / 50, ro = Math.round(lon * 50) / 50;
  let r;
  try {
    r = await cachedFetch(`nearby:${rl},${ro}`, { freshMs: 30000, keepSeconds: 300, source: 'adsb' }, async () => {
      const data = await adsbFetch(`/v2/point/${rl}/${ro}/${RADIUS_NM}`);
      const body = buildBody(data);
      await addRoutes(body.planes);
      return body;
    });
  } catch (e) {
    const busy = e instanceof RateLimited;
    return NextResponse.json({ error: busy ? t('שירות המיקום החי עמוס כרגע. ננסה שוב בעוד רגע.') : t('לא הצלחנו לקבל את המטוסים באזור. נסה שוב בעוד רגע.'), busy },
      { status: busy ? 503 : 502, headers: noStore });
  }
  return NextResponse.json({ ...localizeNearby(r.value, t), stale: r.stale }, { headers: cdnHeaders(30, 30) });
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
        lat: Math.round(a.lat * 1000) / 1000,
        lon: Math.round(a.lon * 1000) / 1000,
        track: a.track != null ? Math.round(a.track) : null,
        fromYou: a.dir != null ? compass(a.dir) : null,
        heading: a.track != null ? compass(a.track) : null,
        dir: a.dir != null ? Math.round(a.dir) : null
      };
    })
    .sort((x, y) => x.distKm - y.distKm)
    .slice(0, 25);

  return { radiusKm: Math.round(RADIUS_NM * 1.852), planes, at: new Date().toISOString() };
}

// מאיפה לאן: מחפשים את הטיסה בלוח של נתב״ג לפי אות הקריאה (ELY571 = LY571).
// עובד לטיסות שממריאות מנתב״ג או נוחתות בו. לטיסות אחרות, או לאותות קריאה עם אותיות (WZZ12AB), אין לנו מסלול.
async function addRoutes(planes) {
  let rows;
  try { rows = (await fullBoard()).rows; } catch { return; }
  const now = Date.now();
  for (const p of planes) {
    const f = p.callsign && parseFlight(p.callsign);
    if (!f || f.suffix) continue;
    let best = null, bestDiff = Infinity;
    for (const r of rows) {
      if (r.op !== f.airline || r.fn !== f.number) continue;
      const t = localToInstant(r.ptol, 'Asia/Jerusalem');
      const diff = t ? Math.abs(t - now) : Infinity;
      if (diff < bestDiff && diff < 4 * 3600e3) { best = r; bestDiff = diff; }
    }
    if (!best) continue;
    const tlv = { code: 'TLV', city: 'תל אביב', cityEn: 'Tel Aviv' }, other = { code: best.loc, city: best.city, cityEn: best.cityEn ? titleCase(best.cityEn) : null };
    p.route = best.dir === 'D' ? { from: tlv, to: other } : { from: other, to: tlv };
  }
}

// השמות במטמון בעברית: באנגלית מתרגמים חברה, כיוון ועיר לפני השליחה
function localizeNearby(body, t) {
  if (t.lang === 'he') return body;
  const city = (c) => (c ? { ...c, city: c.cityEn || t.raw(c.city) } : c);
  return {
    ...body,
    planes: body.planes.map((p) => ({
      ...p,
      airline: p.callsign ? airlineOf(p.callsign, t) : p.airline,
      fromYou: p.dir != null ? compass(p.dir, t) : p.fromYou && t.raw(p.fromYou),
      heading: p.track != null ? compass(p.track, t) : p.heading && t.raw(p.heading),
      route: p.route ? { from: city(p.route.from), to: city(p.route.to) } : p.route
    }))
  };
}
