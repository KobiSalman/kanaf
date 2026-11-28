import { NextResponse } from 'next/server';
import { lookupLive, estimatePosition, CALLSIGN_RE } from '../../../lib/adsb';
import { AIRPORTS } from '../../../lib/airports';
import { distanceKm } from '../../../lib/aviation';
import { cachedFetch, cdnHeaders, noStore, RateLimited } from '../../../lib/cache';
import { tOf } from '../../../lib/i18nServer';
import { localizeView } from '../../../lib/geo';

// מיקום חי בזמן אמת מרשת ה-ADS-B הקהילתית adsb.lol, דרך המטמון המשותף:
// גם אם אלף אנשים עוקבים אחרי אותה טיסה, adsb.lol מקבל פנייה אחת כל 10 שניות.
export async function GET(request) {
  const t = tOf(request);
  const { searchParams } = new URL(request.url);
  const callsign = (searchParams.get('callsign') || '').replace(/\s+/g, '').toUpperCase();
  if (!CALLSIGN_RE.test(callsign)) {
    return NextResponse.json({ error: t('אות קריאה לא תקין') }, { status: 400, headers: noStore });
  }
  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  const alt = (searchParams.get('alt') || '').trim().toUpperCase();
  const cs = (searchParams.get('cs') || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => CALLSIGN_RE.test(x)).slice(0, 4);
  const from = (searchParams.get('from') || '').trim().toUpperCase();
  const to = (searchParams.get('to') || '').trim().toUpperCase();
  const direction = searchParams.get('dir') === 'arrival' ? 'arrival' : 'departure';
  const etaMs = Number(searchParams.get('eta')) || null;
  const depMs = Number(searchParams.get('dep')) || null;
  const key = `live:${[callsign, reg, alt, cs.join(','), from, to].join('|')}`;

  try {
    const r = await cachedFetch(key, {
      // באוויר: כל 3 דקות, וכל דקה כשהמטוס כבר קרוב ליעד (פחות מ-200 ק״מ) או על הקרקע.
      // לא נמצא (מחוץ לקליטה או לפני המראה): כל 3 דקות
      freshMs: (v) => {
        if (!v?.found) return 180000;
        if (v.live?.isGround) return 60000;
        const dest = AIRPORTS[to];
        const near = dest && distanceKm(v.live.latitude, v.live.longitude, dest[0], dest[1]) < 200;
        return near ? 60000 : 180000;
      }, keepSeconds: 900, source: 'adsb' },
      () => lookupLive({ callsign, reg, alt, cs, from, to, direction, etaMs, depMs }));
    const body = { ...r.value, stale: r.stale };
    if (body.view) body.view = localizeView(body.view, t);
    if (!body.found) {
      const est = estimatePosition({ from, to, depMs, etaMs, direction });
      if (est) body.estimate = { ...est, view: localizeView(est.view, t) };
    }
    return NextResponse.json(body, { headers: cdnHeaders(50, 60) });
  } catch (e) {
    const busy = e instanceof RateLimited;
    return NextResponse.json(
      { error: busy ? t('שירות המיקום החי עמוס כרגע. ננסה שוב בעוד רגע.') : t('לא הצלחנו לקבל מיקום חי'), busy },
      { status: busy ? 503 : 502, headers: noStore }
    );
  }
}
