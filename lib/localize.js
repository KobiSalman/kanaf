// התשובות של ה-API נשמרות במטמון המשותף בעברית, ומתורגמות רק ברגע שליחתן לדפדפן.
// כך כל השפות חולקות אותו מטמון, ואף שפה לא מוסיפה בקשות ל-adsb.lol או ללוח של נתב״ג.
// שימו לב: באנגלית השדות cityHe / statusHe / airline מכילים את הטקסט לתצוגה בשפה שביקשו.
import { heT } from './i18n';
import { localizeView } from './geo';
import { titleCase } from './iaa';

// סטטוסים מהלוח של נתב״ג
const STATUS_EN = {
  'ON TIME': 'On time', DELAYED: 'Delayed', DEPARTED: 'Departed', LANDED: 'Landed', LANDING: 'Landing',
  CANCELED: 'Cancelled', CANCELLED: 'Cancelled', FINAL: 'Final call', 'NOT FINAL': 'Not final', EARLY: 'Early'
};

export function statusText(statusEn, statusHe, t = heT) {
  if (t.lang === 'he') return statusHe || null;
  if (!statusEn) return statusHe ? t.raw(statusHe) : null;
  return t.has(statusEn) ? t.raw(statusEn) : STATUS_EN[statusEn] || titleCase(statusEn);
}

// שם חברה: התרגום שלנו לשם העברי, ואם אין, השם האנגלי מהלוח
export function airlineName(he, en, t = heT) {
  if (t.lang === 'he' || !he) return he || en || null;
  if (!/[\u0590-\u05FF]/.test(he)) return he;
  if (t.has(he)) return t.raw(he);
  return en || he;
}

const side = (s, t) => (s ? { ...s, cityHe: s.cityEn || (s.cityHe && t.has(s.cityHe) ? t.raw(s.cityHe) : null), countryHe: s.countryEn ? titleCase(s.countryEn) : s.countryHe, airport: s.airport ? t.raw(s.airport) : s.airport } : s);

export function localizeFlight(f, t = heT) {
  if (!f || t.lang === 'he') return f;
  return {
    ...f,
    airline: airlineName(f.airline, f.airlineEn, t),
    statusHe: statusText(f.statusEn, f.statusHe, t),
    departure: side(f.departure, t),
    arrival: side(f.arrival, t),
    codeshares: (f.codeshares || []).map((c) => ({ ...c, airline: airlineName(c.airline, c.airlineEn, t) })),
    view: localizeView(f.view, t)
  };
}

export function localizeRow(r, t = heT) {
  if (t.lang === 'he') return r;
  return { ...r, city: r.cityEn ? titleCase(r.cityEn) : r.city, country: r.countryEn ? titleCase(r.countryEn) : r.country, opName: airlineName(r.opName, r.opNameEn, t), stHe: statusText(r.st, r.stHe, t) };
}
