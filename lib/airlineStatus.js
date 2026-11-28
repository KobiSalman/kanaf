// התאמה בין טיסה לבין מצב חברת התעופה בישראל (data/airlines-status.json)
import STATUS from '../data/airlines-status.json';
import { heT } from './i18n';

export const AIRLINE_STATUS = STATUS;

// "2026-11-23" -> "23.11.2026" בעברית, "23 Nov 2026" באנגלית
const heDate = (iso, t = heT) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (t.lang === 'he') return `${Number(d)}.${Number(m)}.${y}`;
  return new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+y, m - 1, +d));
};
export { heDate };

export function findAirline({ flight, callsign }) {
  const iata = (flight || '').slice(0, 2).toUpperCase();
  const icao = (callsign || '').match(/^[A-Z]{3}/)?.[0];
  return STATUS.airlines.find((a) => a.iata === iata) || (icao && STATUS.airlines.find((a) => a.icao === icao)) || null;
}

// מחזיר אזהרה אם החברה או הקו לא פועלים בתאריך הטיסה
export function assessFlight(f, t = heT) {
  const found = findAirline(f);
  if (!found) return null;
  const a = { ...found, name: t.raw(found.name), note: found.note ? t.raw(found.note) : found.note };
  const date = f.date;
  const other = f.departure.iata === 'TLV' ? f.arrival.iata : f.departure.iata;

  const route = (a.routes || []).find((r) => r.iata === other);
  if (route && route.status === 'suspended' && (!route.until || route.until >= date)) {
    return {
      level: 'bad', airline: a,
      title: t('{airline} לא מפעילה כרגע את הקו ל-{code}', { airline: a.name, code: other }),
      text: (route.note && t.raw(route.note)) || (route.until ? t('הקו מושהה עד {date}.', { date: heDate(route.until, t) }) : t('הקו מושהה עד הודעה חדשה.'))
    };
  }
  if (a.status === 'suspended' && (!a.until || a.until >= date)) {
    return {
      level: 'bad', airline: a,
      title: t('{airline} לא טסה כרגע לישראל', { airline: a.name }),
      text: [a.until ? t('ההשהיה בתוקף עד {date}.', { date: heDate(a.until, t) }) : null, a.note].filter(Boolean).join(' ')
    };
  }
  if (a.status === 'returning' && (!a.date || a.date > date)) {
    return {
      level: 'warn', airline: a,
      title: t('{airline} עוד לא חזרה לטוס לישראל', { airline: a.name }),
      text: [a.date ? t('החזרה מתוכננת ל-{date}.', { date: heDate(a.date, t) }) : null, a.note].filter(Boolean).join(' ')
    };
  }
  return { level: 'ok', airline: a, title: t('{airline} טסה לישראל כרגע', { airline: a.name }), text: a.note || '' };
}
