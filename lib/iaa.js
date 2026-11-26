// לוח הטיסות של נתב״ג מרשות שדות התעופה (data.gov.il, מידע פתוח, מתעדכן כל 15 דקות).
// מכיל כל טיסה מישראל ואליה: זמנים בשעון ישראל, סטטוס בעברית, טרמינל ודלפקי צ׳ק-אין.
import { cachedFetch } from './cache';
import { localToInstant } from './time';
import { AIRPORTS } from './airports';
import { TIMEZONES } from './timezones';
import { distanceKm } from './aviation';
import STATUS from '../data/airlines-status.json';

const RESOURCE = 'e83f763b-b7d7-479e-b172-ae981ddc6de5';
const FRESH_MS = 10 * 60 * 1000;
const KEEP_SECONDS = 2 * 24 * 3600;

const ICAO_TO_IATA = Object.fromEntries(STATUS.airlines.filter((a) => a.icao).map((a) => [a.icao, a.iata]));
const IATA_TO_ICAO = Object.fromEntries(STATUS.airlines.filter((a) => a.icao).map((a) => [a.iata, a.icao]));
const HE_NAME = Object.fromEntries(STATUS.airlines.map((a) => [a.iata, a.name]));

// LY315 / ELY315 / 6H055 -> { airline: 'LY', number: 315, suffix: '' }
export function parseFlight(code) {
  const icao = code.match(/^([A-Z]{3})(\d{1,4})([A-Z]?)$/);
  if (icao && ICAO_TO_IATA[icao[1]]) return { airline: ICAO_TO_IATA[icao[1]], number: Number(icao[2]), suffix: icao[3] };
  const iata = code.match(/^([A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
  if (iata) return { airline: iata[1], number: Number(iata[2]), suffix: iata[3] };
  return null;
}

async function iaaRecords(filters) {
  const f = filters ? `&filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
  const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE}&limit=5000${f}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`iaa ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error('iaa not success');
  return body.result.records.map(({ _id, ...r }) => r);
}

async function airlineRows(airline) {
  const r = await cachedFetch(`iaa:${airline}`, { freshMs: FRESH_MS, keepSeconds: KEEP_SECONDS, source: 'iaa' },
    () => iaaRecords({ CHOPER: airline }));
  return { rows: r.value, at: r.at, stale: r.stale };
}

// זמן מקומי בשדה אחר: "YYYY-MM-DDTHH:MM:00", כמו שהשאר באפליקציה מצפה
function toLocal(ms, timeZone) {
  if (!ms || !timeZone) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00`;
}

// משך טיסה משוער לפי המרחק: מהירות ממוצעת של כ-780 קמ״ש ועוד חצי שעה להמראה ולנחיתה
function blockMs(other) {
  const a = AIRPORTS.TLV, b = AIRPORTS[other];
  if (!b) return null;
  return ((distanceKm(a[0], a[1], b[0], b[1]) / 780) + 0.5) * 3600e3;
}

function normalize(r) {
  const isDep = r.CHAORD === 'D';
  const st = r.CHRMINE;
  const other = r.CHLOC1;
  const tz = TIMEZONES[other] || null;
  const dur = blockMs(other);
  const sched = localToInstant(r.CHSTOL, 'Asia/Jerusalem');
  const est = localToInstant(r.CHPTOL || r.CHSTOL, 'Asia/Jerusalem');
  const delay = sched && est ? Math.round((est - sched) / 60000) : null;

  const tlv = {
    iata: 'TLV', airport: 'נתב״ג', cityHe: 'תל אביב', timezone: 'Asia/Jerusalem',
    terminal: r.CHTERM != null ? String(r.CHTERM) : null, gate: null,
    checkin: r.CHCINT || null, checkinZone: r.CHCKZN || null,
    scheduled: r.CHSTOL, estimated: r.CHPTOL || r.CHSTOL, delay: delay > 0 ? delay : null,
    actual: (isDep && st === 'DEPARTED') || (!isDep && st === 'LANDED') ? r.CHPTOL : null
  };
  const away = {
    iata: other, airport: r.CHLOC1D, cityHe: r.CHLOC1TH || null, countryHe: r.CHLOC1CH || null,
    timezone: tz, terminal: null, gate: null, estimatedByUs: true,
    scheduled: dur && tz ? toLocal(sched + (isDep ? dur : -dur), tz) : null,
    estimated: dur && tz ? toLocal(est + (isDep ? dur : -dur), tz) : null,
    actual: !isDep && (st === 'LANDED' || st === 'LANDING') && dur && tz ? toLocal(est - dur, tz) : null
  };

  let status = 'scheduled';
  if (st === 'CANCELED' || st === 'CANCELLED') status = 'cancelled';
  else if (!isDep && st === 'LANDED') status = 'landed';
  else if ((isDep && st === 'DEPARTED') || st === 'LANDING') status = 'active';

  const icao = IATA_TO_ICAO[r.CHOPER];
  return {
    source: 'iaa',
    flight: `${r.CHOPER}${Number(r.CHFLTN)}`,
    callsign: icao ? `${icao}${Number(r.CHFLTN)}` : null,
    airlineIata: r.CHOPER,
    airline: HE_NAME[r.CHOPER] || r.CHOPERD.replace(/\s+/g, ' ').trim(),
    date: (isDep ? r.CHSTOL : away.scheduled || r.CHSTOL).slice(0, 10),
    boardDate: r.CHSTOL.slice(0, 10),
    status,
    statusHe: r.CHRMINH || null,
    statusEn: st,
    direction: isDep ? 'departure' : 'arrival',
    departure: isDep ? tlv : away,
    arrival: isDep ? away : tlv,
    aircraft: null,
    live: null
  };
}

// מחזיר { flight } אם נמצאה טיסה בתאריך, { dates } אם הטיסה קיימת בתאריכים אחרים, או null
export async function iaaFlight(code, date) {
  const p = parseFlight(code);
  if (!p) return null;
  const board = await airlineRows(p.airline);
  const rows = board.rows.filter((r) => Number(r.CHFLTN) === p.number);
  if (!rows.length) return null;
  const flights = rows.map(normalize);
  // תאריך הטיסה: תאריך ההמראה. בטיסה נכנסת לפעמים נוח לחפש לפי תאריך הנחיתה בישראל, אז מקבלים גם אותו
  const match = flights.find((f) => f.date === date) || flights.find((f) => f.boardDate === date);
  if (match) return { flight: { ...match, fetchedAt: new Date(board.at).toISOString(), stale: !!board.stale } };
  return { dates: [...new Set(flights.map((f) => f.date))].sort() };
}

// ---------- הלוח המלא (ללשונית "לוח") ----------

const BOARD_FRESH_MS = 5 * 60 * 1000;

// רק השדות שהלוח צריך, כדי שהמטמון יישאר קטן
const slimRow = (r) => ({
  op: r.CHOPER, fn: Number(r.CHFLTN), opName: (HE_NAME[r.CHOPER] || r.CHOPERD || '').replace(/\s+/g, ' ').trim(),
  dir: r.CHAORD, stol: r.CHSTOL, ptol: r.CHPTOL || r.CHSTOL,
  loc: r.CHLOC1, city: r.CHLOC1TH || r.CHLOC1T || r.CHLOC1, cityEn: r.CHLOC1T || '', country: r.CHLOC1CH || '',
  term: r.CHTERM != null ? String(r.CHTERM) : null, cin: r.CHCINT || null, zone: r.CHCKZN || null,
  st: r.CHRMINE || '', stHe: r.CHRMINH || ''
});

export async function fullBoard() {
  const r = await cachedFetch('iaa:board', { freshMs: BOARD_FRESH_MS, keepSeconds: 24 * 3600, source: 'iaa' },
    async () => (await iaaRecords(null)).map(slimRow));
  return { rows: r.value, at: r.at, stale: r.stale };
}
