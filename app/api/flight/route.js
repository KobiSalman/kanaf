import { NextResponse } from 'next/server';
import { cacheGet, cacheSet } from '../../../lib/cache';
import { localToInstant } from '../../../lib/time';

// השרת מחזיק את המפתח – הדפדפן אף פעם לא רואה אותו.
// כל מספר טיסה נשמר במטמון משותף, כך שכל המשתמשים חולקים אותה בקשה ל-Aviationstack.
const KEEP_SECONDS = 3 * 24 * 3600; // שומרים 3 ימים, כדי שיהיה מה להציג גם אם המקור לא זמין

// כמה זמן הנתונים נחשבים טריים: קרוב להמראה ובזמן טיסה מרעננים יותר
function freshSeconds(items) {
  if (!items.length) return 30 * 60;
  const now = Date.now();
  let best = 3 * 3600;
  for (const f of items) {
    const dep = f.departure || {};
    const depAt = localToInstant(dep.actual || dep.estimated || dep.scheduled, dep.timezone);
    if (f.flight_status === 'active') best = Math.min(best, 15 * 60);
    else if (depAt && !dep.actual && depAt - now < 3 * 3600e3 && depAt - now > -3 * 3600e3) best = Math.min(best, 10 * 60);
    else if (depAt && Math.abs(depAt - now) < 24 * 3600e3) best = Math.min(best, 30 * 60);
  }
  return best;
}

// רק השדות שאנחנו צריכים, כדי לשמור את המטמון קטן
const slim = (f) => ({
  flight_date: f.flight_date,
  flight_status: f.flight_status,
  flight: f.flight ? { iata: f.flight.iata, icao: f.flight.icao, codeshared: f.flight.codeshared ? true : null } : null,
  airline: f.airline ? { name: f.airline.name } : null,
  departure: f.departure,
  arrival: f.arrival,
  aircraft: f.aircraft,
  live: f.live
});

function pick(side) {
  if (!side) return null;
  return {
    iata: side.iata,
    airport: side.airport,
    timezone: side.timezone,
    terminal: side.terminal,
    gate: side.gate,
    baggage: side.baggage ?? null,
    delay: side.delay,
    scheduled: side.scheduled,
    estimated: side.estimated,
    actual: side.actual
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
  // ELY084 -> ELY84, LY0084 -> LY84: Aviationstack שומר מספרי טיסה בלי אפסים מובילים
  const parts = raw.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
  const flight = parts ? parts[1] + String(Number(parts[2])) + parts[3] : raw;
  const date = searchParams.get('date') || '';

  if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(flight)) {
    return NextResponse.json({ error: 'מספר טיסה לא תקין. לדוגמה: LY315 או ELY315' }, { status: 400 });
  }
  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) {
    return NextResponse.json({ error: 'חסר מפתח API בשרת (AVIATIONSTACK_KEY)' }, { status: 500 });
  }

  const cacheKey = `flight:${flight}`;
  const cached = await cacheGet(cacheKey);
  let payload = cached ? { at: cached.at, data: cached.value } : null;
  let stale = false;

  if (!payload || Date.now() - payload.at > freshSeconds(payload.data) * 1000) {
    // 3 אותיות + מספר = קוד ICAO (למשל ISR730), 2 תווים + מספר = קוד IATA (למשל 6H730)
    const param = /^[A-Z]{3}\d/.test(flight) ? 'flight_icao' : 'flight_iata';
    const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&${param}=${flight}&limit=20`;
    let body = null, ok = false, quota = false;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      body = await res.json().catch(() => null);
      ok = res.ok && body && !body.error;
      quota = body?.error?.code === 'usage_limit_reached';
    } catch {}

    if (ok) {
      const entry = await cacheSet(cacheKey, (body.data || []).map(slim), KEEP_SECONDS);
      payload = { at: entry.at, data: entry.value };
    } else if (payload) {
      // המקור לא זמין או שנגמרו הבקשות: מציגים את הנתונים האחרונים שיש, ומסמנים שהם לא עדכניים
      stale = true;
    } else {
      const msg = quota ? 'נגמרו הבקשות החודשיות ל-Aviationstack, ואין לנו עדיין נתונים שמורים על הטיסה הזו' : 'שירות הטיסות לא זמין כרגע. נסה שוב בעוד כמה דקות.';
      return NextResponse.json({ error: msg, quota }, { status: 502 });
    }
  }

  const all = payload.data;
  const onDate = all.filter((f) => !date || f.flight_date === date);
  const chosen = onDate.find((f) => !f.flight?.codeshared) || onDate[0];

  if (!chosen) {
    const dates = [...new Set(all.map((f) => f.flight_date))].sort();
    return NextResponse.json({
      error: dates.length
        ? `לא מצאנו את ${flight} בתאריך הזה. תאריכים זמינים: ${dates.join(', ')}`
        : `לא מצאנו את ${flight}. במסלול החינמי רואים רק טיסות מהימים האחרונים והקרובים.`
    }, { status: 404 });
  }

  return NextResponse.json({
    flight: chosen.flight?.iata || flight,
    callsign: chosen.flight?.icao || null,
    airline: chosen.airline?.name || null,
    date: chosen.flight_date,
    status: chosen.flight_status,
    departure: pick(chosen.departure),
    arrival: pick(chosen.arrival),
    aircraft: chosen.aircraft
      ? { type: chosen.aircraft.iata || chosen.aircraft.icao, registration: chosen.aircraft.registration }
      : null,
    live: chosen.live
      ? {
          updated: chosen.live.updated,
          latitude: chosen.live.latitude,
          longitude: chosen.live.longitude,
          altitudeM: chosen.live.altitude,
          speedKmh: chosen.live.speed_horizontal,
          verticalKmh: chosen.live.speed_vertical,
          direction: chosen.live.direction,
          isGround: chosen.live.is_ground
        }
      : null,
    fetchedAt: new Date(payload.at).toISOString(),
    stale
  });
}
