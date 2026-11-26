import { NextResponse } from 'next/server';
import { AIRPORTS } from '../../../lib/airports';
import { distanceKm, bearingDeg } from '../../../lib/aviation';
import { adsbFetch } from '../../../lib/adsb';
import { cachedFetch, cdnHeaders, noStore, RateLimited } from '../../../lib/cache';

// "המטוס הגיע?": איפה נמצא עכשיו המטוס ששובץ לטיסה שלך, לפי מספר הרישום שלו.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  const from = (searchParams.get('from') || '').trim().toUpperCase();
  const callsign = (searchParams.get('callsign') || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,10}$/.test(reg)) {
    return NextResponse.json({ error: 'מספר רישום לא תקין' }, { status: 400, headers: noStore });
  }

  let r;
  try {
    r = await cachedFetch(`inbound:${reg}|${from}|${callsign}`, { freshMs: 180000, keepSeconds: 3600, source: 'adsb' }, async () => {
      const data = await adsbFetch(`/v2/registration/${encodeURIComponent(reg)}`);
      return assess(data, from, callsign);
    });
  } catch (e) {
    const busy = e instanceof RateLimited;
    return NextResponse.json({ error: busy ? 'השירות עמוס כרגע' : 'לא הצלחנו לבדוק איפה המטוס', busy }, { status: busy ? 503 : 502, headers: noStore });
  }
  return NextResponse.json({ ...r.value, stale: r.stale }, { headers: cdnHeaders(60, 120) });
}

function assess(data, from, callsign) {
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
  return body;
}
