import { NextResponse } from 'next/server';
import { lookupLive, CALLSIGN_RE } from '../../../lib/adsb';
import { cachedFetch, cdnHeaders, noStore, RateLimited } from '../../../lib/cache';

// מיקום חי בזמן אמת מרשת ה-ADS-B הקהילתית adsb.lol, דרך המטמון המשותף:
// גם אם אלף אנשים עוקבים אחרי אותה טיסה, adsb.lol מקבל פנייה אחת כל 10 שניות.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const callsign = (searchParams.get('callsign') || '').replace(/\s+/g, '').toUpperCase();
  if (!CALLSIGN_RE.test(callsign)) {
    return NextResponse.json({ error: 'אות קריאה לא תקין' }, { status: 400, headers: noStore });
  }
  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  const alt = (searchParams.get('alt') || '').trim().toUpperCase();
  const from = (searchParams.get('from') || '').trim().toUpperCase();
  const to = (searchParams.get('to') || '').trim().toUpperCase();
  const direction = searchParams.get('dir') === 'arrival' ? 'arrival' : 'departure';
  const etaMs = Number(searchParams.get('eta')) || null;
  const depMs = Number(searchParams.get('dep')) || null;
  const key = `live:${[callsign, reg, alt, from, to].join('|')}`;

  try {
    const r = await cachedFetch(key, { freshMs: 10000, keepSeconds: 900, source: 'adsb' },
      () => lookupLive({ callsign, reg, alt, from, to, direction, etaMs, depMs }));
    return NextResponse.json({ ...r.value, stale: r.stale }, { headers: cdnHeaders(10, 20) });
  } catch (e) {
    const busy = e instanceof RateLimited;
    return NextResponse.json(
      { error: busy ? 'שירות המיקום החי עמוס כרגע. ננסה שוב בעוד רגע.' : 'לא הצלחנו לקבל מיקום חי', busy },
      { status: busy ? 503 : 502, headers: noStore }
    );
  }
}
