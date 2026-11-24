// מיקום חי מ-adsb.lol (חינם, בלי מפתח), משותף לנתיבים /api/live ו-/api/flight.
import { windowView, placeAt } from './geo';

// אות קריאה: 3 אותיות של חברה, ואז ספרה ועוד עד 4 ספרות או אותיות (ELY315, LOT2YE, BAW94KJ)
export const CALLSIGN_RE = /^[A-Z]{3}\d[A-Z0-9]{0,4}$/;

export async function lookupLive({ callsign, reg }) {
  // מטוסים משדרים לפעמים את המספר עם אפסים מובילים (ELY084) ולפעמים בלי (ELY84)
  const m = callsign.match(/^([A-Z]{3})(\d+)([A-Z]?)$/);
  const variants = [callsign];
  if (m && m[2].length < 3) variants.push(m[1] + m[2].padStart(3, '0') + m[3]);
  if (m && m[2].startsWith('0')) variants.push(m[1] + String(Number(m[2])) + m[3]);

  const urls = variants.map((v) => `https://api.adsb.lol/v2/callsign/${v}`);
  // גיבוי: חיפוש לפי מספר הרישום, רק אם המטוס משדר את אות הקריאה של הטיסה הזו (או לא משדר בכלל).
  // אחרת זה המטוס בטיסה אחרת שלו, ואסור להציג את המיקום הזה כמיקום של הטיסה שלנו.
  if (reg && /^[A-Z0-9-]{3,10}$/.test(reg)) urls.push(`https://api.adsb.lol/v2/registration/${encodeURIComponent(reg)}`);

  let ac = null;
  for (const url of urls) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const isReg = url.includes('/registration/');
    ac = (data.ac || []).find((a) => typeof a.lat === 'number' &&
      (!isReg || !(a.flight || '').trim() || variants.includes((a.flight || '').trim()))) || null;
    if (ac) break;
  }
  if (!ac) return { found: false };

  const onGround = ac.alt_baro === 'ground';
  const altFt = onGround ? 0 : Number(ac.alt_baro) || 0;
  const seenMs = Math.round((ac.seen_pos ?? ac.seen ?? 0) * 1000);
  const body = {
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
    body.view = onGround ? { over: placeAt(ac.lat, ac.lon), left: null, right: null } : windowView(body.live);
  } catch {
    body.view = null;
  }
  return body;
}
