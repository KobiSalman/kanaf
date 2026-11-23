// התאמה בין טיסה לבין מצב חברת התעופה בישראל (data/airlines-status.json)
import STATUS from '../data/airlines-status.json';

export const AIRLINE_STATUS = STATUS;

const heDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};
export { heDate };

export function findAirline({ flight, callsign }) {
  const iata = (flight || '').slice(0, 2).toUpperCase();
  const icao = (callsign || '').match(/^[A-Z]{3}/)?.[0];
  return STATUS.airlines.find((a) => a.iata === iata) || (icao && STATUS.airlines.find((a) => a.icao === icao)) || null;
}

// מחזיר אזהרה אם החברה או הקו לא פועלים בתאריך הטיסה
export function assessFlight(f) {
  const a = findAirline(f);
  if (!a) return null;
  const date = f.date;
  const other = f.departure.iata === 'TLV' ? f.arrival.iata : f.departure.iata;

  const route = (a.routes || []).find((r) => r.iata === other);
  if (route && route.status === 'suspended' && (!route.until || route.until >= date)) {
    return {
      level: 'bad', airline: a,
      title: `${a.name} לא מפעילה כרגע את הקו ל-${other}`,
      text: route.note || (route.until ? `הקו מושהה עד ${heDate(route.until)}.` : 'הקו מושהה עד הודעה חדשה.')
    };
  }
  if (a.status === 'suspended' && (!a.until || a.until >= date)) {
    return {
      level: 'bad', airline: a,
      title: `${a.name} לא טסה כרגע לישראל`,
      text: [a.until ? `ההשהיה בתוקף עד ${heDate(a.until)}.` : null, a.note].filter(Boolean).join(' ')
    };
  }
  if (a.status === 'returning' && (!a.date || a.date > date)) {
    return {
      level: 'warn', airline: a,
      title: `${a.name} עוד לא חזרה לטוס לישראל`,
      text: [a.date ? `החזרה מתוכננת ל-${heDate(a.date)}.` : null, a.note].filter(Boolean).join(' ')
    };
  }
  return { level: 'ok', airline: a, title: `${a.name} טסה לישראל כרגע`, text: a.note || '' };
}
