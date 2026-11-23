import { NextResponse } from 'next/server';

// השרת מחזיק את המפתח – הדפדפן אף פעם לא רואה אותו.
// מטמון קצר כדי לחסוך בקשות (100 בחודש במסלול החינמי).
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

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
  const flight = (searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
  const date = searchParams.get('date') || '';

  if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(flight)) {
    return NextResponse.json({ error: 'מספר טיסה לא תקין. לדוגמה: LY315' }, { status: 400 });
  }
  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) {
    return NextResponse.json({ error: 'חסר מפתח API בשרת (AVIATIONSTACK_KEY)' }, { status: 500 });
  }

  const cacheKey = flight;
  let payload = cache.get(cacheKey);
  if (!payload || Date.now() - payload.at > TTL_MS) {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&flight_iata=${flight}&limit=20`;
    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch {
      return NextResponse.json({ error: 'לא הצלחנו להתחבר לשירות הטיסות' }, { status: 502 });
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.error) {
      const msg = body?.error?.code === 'usage_limit_reached'
        ? 'נגמרו הבקשות החודשיות במסלול החינמי'
        : 'שירות הטיסות החזיר שגיאה';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    payload = { at: Date.now(), data: body.data || [] };
    cache.set(cacheKey, payload);
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
    fetchedAt: new Date(payload.at).toISOString()
  });
}
