// לוגיקה של טיסה, בלי תצוגה (כדי שאפשר יהיה לבדוק אותה)
import { hhmm, minutesLabel } from './time';

// טיסה בשיתוף קוד: מי באמת מפעיל את הטיסה. אם המטוס כבר משדר, לפי אות הקריאה שלו (ודאי).
// אחרת לפי מספר הטיסה הנמוך מבין כולם, כי מספרי שיתוף קוד הם בדרך כלל גבוהים (הערכה)
export function codeshareInfo(f) {
  const others = f.codeshares || [];
  if (!others.length) return null;
  const own = { flight: f.flight, iata: f.airlineIata, fn: parseInt(String(f.flight).slice(2), 10), airline: f.airline, callsign: f.callsign, own: true };
  const all = [own, ...others];
  let op = f.broadcastCallsign ? all.find((c) => c.callsign && c.callsign === f.broadcastCallsign) : null;
  const certain = !!op;
  if (!op) op = all.reduce((a, b) => (b.fn < a.fn ? b : a));
  return { op, certain, others: all.filter((c) => c !== op) };
}

// חותמת אדומה על כרטיס הטיסה: עיכוב של 15 דקות ומעלה, או טיסה שבוטלה
export function delayStamp(f) {
  if (f.status === 'cancelled' || /CANCEL/.test(f.statusEn || '')) return { title: 'בוטלה', sub: 'בדקו מול חברת התעופה' };
  const arr = f.direction === 'arrival';
  const side = arr ? f.arrival : f.departure;
  const dl = side.delay || (arr ? null : f.arrival.delay) || null;
  const flagged = f.statusEn === 'DELAYED';
  if (!(dl >= 15) && !flagged) return null;
  const done = arr ? !!f.arrival.actual : !!f.departure.actual;
  const t = hhmm(side.actual || side.estimated);
  return {
    title: 'עיכוב',
    line: dl >= 15 ? minutesLabel(dl) : null,
    sub: t ? `${done ? (arr ? 'נחתה' : 'המריאה') : arr ? 'נחיתה' : 'המראה'} בשעה ${t}` : null
  };
}

