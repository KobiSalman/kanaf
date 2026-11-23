import { NextResponse } from 'next/server';
import { AIRPORTS } from '../../../lib/airports';
import { distanceKm, bearingDeg } from '../../../lib/aviation';

// "המטוס הגיע?": איפה נמצא עכשיו המטוס ששובץ לטיסה שלך, לפי מספר הרישום שלו.
const cache = new Map();
const TTL_MS = 60 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  const from = (searchParams.get('from') || '').trim().toUpperCase();
  const callsign = (searchParams.get('callsign') || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,10}$/.test(reg)) {
    return NextResponse.json({ error: 'מספר רישום לא תקין' }, { status: 400 });
  }

  const key = `${reg}|${from}|${callsign}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  let data;
  try {
    const res = await fetch(`https://api.adsb.lol/v2/registration/${encodeURIComponent(reg)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'לא הצלחנו לבדוק איפה המטוס' }, { status: 502 });
  }

  const ac = (data.ac || []).find((a) => typeof a.lat === 'number');
  const airport = AIRPORTS[from];
  let body;

  if (!ac) {
    body = { state: 'silent' };
  } else {
    const nowCallsign = (ac.flight || '').trim() || null;
    const onGround = ac.alt_baro === 'ground' || (Number(ac.alt_baro) < 300 && (ac.gs || 0) < 40);
    const speedKmh = (ac.gs || 0) * 1.852;
    const base = { nowCallsign, onGround, altFt: onGround ? 0 : Number(ac.alt_baro) || 0, speedKmh: Math.round(speedKmh) };

    if (!airport) {
      body = { ...base, state: onGround ? 'ground_unknown' : 'flying_unknown' };
    } else {
      const dist = distanceKm(ac.lat, ac.lon, airport[0], airport[1]);
      const toward = bearingDeg(ac.lat, ac.lon, airport[0], airport[1]);
      const diff = Math.abs((((ac.track ?? toward) - toward + 540) % 360) - 180);
      const distKm = Math.round(dist);

      if (onGround && dist < 8) body = { ...base, distKm, state: 'at_airport' };
      else if (onGround) body = { ...base, distKm, state: 'ground_elsewhere' };
      else if (nowCallsign && callsign && nowCallsign === callsign) body = { ...base, distKm, state: 'is_our_flight' };
      else if (diff < 50 && speedKmh > 150) {
        // זמן הגעה משוער: מרחק חלקי מהירות, ועוד כ-10 דקות לגישה ולנחיתה
        const etaMin = Math.round((dist / speedKmh) * 60 + 10);
        body = { ...base, distKm, etaMin, state: 'inbound' };
      } else body = { ...base, distKm, state: 'flying_elsewhere' };
    }
  }

  body.checkedAt = new Date().toISOString();
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
