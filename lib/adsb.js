// מיקום חי מ-adsb.lol (חינם, בלי מפתח), משותף לנתיבים /api/live ו-/api/flight.
import { windowView, placeAt } from './geo';
import { AIRPORTS } from './airports';
import { distanceKm, bearingDeg } from './aviation';
import { RateLimited, countUsage } from './cache';

// כל פנייה ל-adsb.lol עוברת כאן: 429 = "יותר מדי בקשות", ואז כל האתר עושה הפסקה קצרה
// בלי מפתח המכסה היא 500 בקשות ביום. מפתח (ADSB_API_KEY ב-Vercel) מעלה אותה, לפי התוכנית
export async function adsbFetch(path) {
  const headers = process.env.ADSB_API_KEY ? { 'x-api-key': process.env.ADSB_API_KEY } : {};
  countUsage('adsb');
  const res = await fetch(`https://api.adsb.lol${path}`, { cache: 'no-store', headers });
  if (res.status === 429) throw new RateLimited('adsb', Number(res.headers.get('retry-after')) || null);
  if (!res.ok) throw new Error(`adsb ${res.status}`);
  return res.json();
}

// אות קריאה: 3 אותיות של חברה, ואז ספרה ועוד עד 4 ספרות או אותיות (ELY315, LOT2YE, BAW94KJ)
export const CALLSIGN_RE = /^[A-Z]{3}\d[A-Z0-9]{0,4}$/;

export async function lookupLive({ callsign, reg, alt, cs = [], from, to, direction, etaMs, depMs }) {
  // מטוסים משדרים לפעמים את המספר עם אפסים מובילים (ELY084) ולפעמים בלי (ELY84)
  const m = callsign.match(/^([A-Z]{3})(\d+)([A-Z]?)$/);
  const variants = [callsign];
  if (m && m[2].length < 3) variants.push(m[1] + m[2].padStart(3, '0') + m[3]);
  if (m && m[2].startsWith('0')) variants.push(m[1] + String(Number(m[2])) + m[3]);

  // טיסה בשיתוף קוד (LY9607 = EY598): המטוס משדר את אות הקריאה של החברה המפעילה
  for (const c of cs) if (CALLSIGN_RE.test(c) && !variants.includes(c)) variants.push(c);
  const urls = variants.map((v) => `/v2/callsign/${v}`);
  // גיבוי: חיפוש לפי מספר הרישום, רק אם המטוס משדר את אות הקריאה של הטיסה הזו (או לא משדר בכלל).
  // אחרת זה המטוס בטיסה אחרת שלו, ואסור להציג את המיקום הזה כמיקום של הטיסה שלנו.
  if (reg && /^[A-Z0-9-]{3,10}$/.test(reg)) urls.push(`/v2/registration/${encodeURIComponent(reg)}`);

  // אות קריאה ששודר בפועל ונמצא קודם (למשל TVF35KJ במקום TVF3461)
  if (alt && CALLSIGN_RE.test(alt) && !variants.includes(alt)) {
    variants.unshift(alt);
    urls.unshift(`/v2/callsign/${alt}`);
  }

  let ac = null;
  for (const url of urls) {
    const data = await adsbFetch(url);
    const isReg = url.includes('/registration/');
    ac = (data.ac || []).find((a) => typeof a.lat === 'number' &&
      (!isReg || !(a.flight || '').trim() || variants.includes((a.flight || '').trim()))) || null;
    if (ac) break;
  }
  let matchedByRoute = false;
  if (!ac && from && to) {
    ac = await findByRoute({ prefix: callsign.slice(0, 3), from, to, etaMs, depMs });
    matchedByRoute = !!ac;
  }
  if (!ac) return { found: false };

  const onGround = ac.alt_baro === 'ground';
  const altFt = onGround ? 0 : Number(ac.alt_baro) || 0;
  const seenMs = Math.round((ac.seen_pos ?? ac.seen ?? 0) * 1000);
  const body = {
    found: true,
    registration: ac.r || null,
    type: ac.t || null,
    hex: ac.hex || null,
    broadcastCallsign: (ac.flight || '').trim() || null,
    matchedByRoute,
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

// חברות כמו Transavia ו-Wizz משדרות אות קריאה שונה ממספר הטיסה (TO3461 טס כ-TVF35KJ, W46042 כ-WMT2TD).
// מחשבים איפה המטוס אמור להיות עכשיו על המסלול, ומחפשים שם מטוס של אותה חברה שטס לכיוון היעד.
const AIRLINE_GROUPS = [['WZZ', 'WMT', 'WUK', 'WAZ'], ['EZY', 'EJU', 'EZS'], ['TVF', 'TRA'], ['RYR', 'RUK', 'MAY', 'LDM']];
const groupOf = (p) => AIRLINE_GROUPS.find((g) => g.includes(p)) || [p];

export function interpolate([lat1, lon1], [lat2, lon2], f) {
  const r = Math.PI / 180;
  const p1 = [lat1 * r, lon1 * r], p2 = [lat2 * r, lon2 * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2[0] - p1[0]) / 2) ** 2 + Math.cos(p1[0]) * Math.cos(p2[0]) * Math.sin((p2[1] - p1[1]) / 2) ** 2));
  if (!d) return [lat1, lon1];
  const a = Math.sin((1 - f) * d) / Math.sin(d), b = Math.sin(f * d) / Math.sin(d);
  const x = a * Math.cos(p1[0]) * Math.cos(p1[1]) + b * Math.cos(p2[0]) * Math.cos(p2[1]);
  const y = a * Math.cos(p1[0]) * Math.sin(p1[1]) + b * Math.cos(p2[0]) * Math.sin(p2[1]);
  const z = a * Math.sin(p1[0]) + b * Math.sin(p2[0]);
  return [Math.atan2(z, Math.sqrt(x * x + y * y)) / r, Math.atan2(y, x) / r];
}

async function findByRoute({ prefix, from, to, etaMs, depMs }) {
  const a1 = AIRPORTS[from], a2 = AIRPORTS[to];
  if (!a1 || !a2 || !depMs || !etaMs || etaMs <= depMs) return null;
  const now = Date.now();
  const f = Math.min(1, Math.max(0, (now - depMs) / (etaMs - depMs)));
  const [elat, elon] = interpolate(a1, a2, f);
  // ההערכה שלנו למשך הטיסה גסה, ושעת ההמראה בלוח לפעמים מוקדמת מההמראה בפועל:
  // מחפשים גם אחורה וגם קדימה על המסלול (נקודות כפולות, למשל בתחילת הטיסה, מדלגים)
  const fs = [f, Math.max(0.03, f - 0.25), Math.min(1, f + 0.2)].filter((x, i, arr) => arr.findIndex((y) => Math.abs(y - x) < 0.08) === i);
  const points = fs.map((x) => interpolate(a1, a2, x));
  const seen = new Map();
  for (const [plat, plon] of points) {
    let data;
    try { data = await adsbFetch(`/v2/point/${plat.toFixed(3)}/${plon.toFixed(3)}/250`); } catch (e) { if (e instanceof RateLimited) throw e; continue; }
    for (const a of data.ac || []) if (a.hex && !seen.has(a.hex)) seen.set(a.hex, a);
  }
  const group = groupOf(prefix);
  let best = null, bestScore = Infinity;
  for (const a of seen.values()) {
    const cs = (a.flight || '').trim();
    // רק אותות קריאה עם אותיות אחרי המספר (TVF35KJ): מטוס שמשדר אות קריאה מספרי רגיל (ELY318) הוא טיסה אחרת
    if (typeof a.lat !== 'number' || a.alt_baro === 'ground' || typeof a.track !== 'number' || (a.gs || 0) < 150) continue;
    if (!group.includes(cs.slice(0, 3)) || !/^[A-Z]{3}\d+[A-Z]/.test(cs)) continue;
    // מטוס נמוך באמצע הדרך יורד לשדה אחר: פוסלים, אלא אם הוא קרוב למוצא או ליעד שלנו
    const alt = Number(a.alt_baro) || 0;
    const nearEnds = Math.min(distanceKm(a.lat, a.lon, a1[0], a1[1]), distanceKm(a.lat, a.lon, a2[0], a2[1])) < 200;
    if (alt < 18000 && !nearEnds) continue;
    if ((a.baro_rate ?? 0) < -800 && distanceKm(a.lat, a.lon, a2[0], a2[1]) > 350) continue;
    const toDest = bearingDeg(a.lat, a.lon, a2[0], a2[1]);
    const diff = Math.abs(((a.track - toDest + 540) % 360) - 180);
    if (diff > 30) continue;
    // זמן ההגעה לפי המיקום והמהירות שלו חייב להתאים לזמן ההגעה של הטיסה (ההערכה שלנו גסה, לכן שעה)
    const eta = now + (distanceKm(a.lat, a.lon, a2[0], a2[1]) / (a.gs * 1.852)) * 3600e3 + 10 * 60000;
    if (Math.abs(eta - etaMs) > 60 * 60000) continue;
    const off = distanceKm(a.lat, a.lon, elat, elon);
    // הכי חשוב: כיוון לעבר היעד וזמן הגעה שמתאים. המיקום הצפוי שלנו גס, לכן משקל נמוך
    const score = diff + Math.abs(eta - etaMs) / 60000 + off / 40;
    if (score < bestScore) { best = a; bestScore = score; }
  }
  return best;
}

// כשאין קליטה (למשל מעל ירדן וסעודיה אין כמעט קולטני ADS-B): מעריכים איפה המטוס לפי הזמן שעבר מההמראה,
// על המסלול הקצר בין שני שדות התעופה. זו הערכה בלבד, ומסומנת ככזו במסך.
export function estimatePosition({ from, to, depMs, etaMs, direction, now = Date.now() }) {
  const a1 = AIRPORTS[from], a2 = AIRPORTS[to];
  if (!a1 || !a2 || !depMs || !etaMs || etaMs <= depMs) return null;
  // כ-20 דקות של המראה וטיפוס בהתחלה, וכ-20 דקות של ירידה בסוף
  if (now < depMs + 10 * 60e3 || now > etaMs - 10 * 60e3) return null;
  const f = (now - depMs) / (etaMs - depMs);
  const [lat, lon] = interpolate(a1, a2, f);
  const [lat2, lon2] = interpolate(a1, a2, Math.min(1, f + 0.01));
  const heading = bearingDeg(lat, lon, lat2, lon2);
  const view = windowView({ latitude: lat, longitude: lon, direction: heading, altitudeM: 11000 });
  // מטוסים מישראל ואליה לא טסים מעל עיראק, איראן, סוריה, לבנון ותימן, ולכן המסלול הקצר שם לא נכון.
  // במקרה כזה לא מציגים מדינה בכלל, כדי לא להטעות
  if ((from === 'TLV' || to === 'TLV') && ['IQ', 'IR', 'SY', 'LB', 'YE'].includes(view.over?.code)) return null;
  return { latitude: lat, longitude: lon, view, estimated: true };
}
