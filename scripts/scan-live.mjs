// סריקה של כל הטיסות שבאוויר עכשיו מנתב״ג ואליו: האם כנף מוצאת להן מיקום חי, ואיך.
// הרצה: node scripts/scan-live.mjs http://localhost:3000   (שרת של כנף שרץ מקומית או האתר עצמו)
import { localToInstant } from '../lib/time.js';

const BASE = process.argv[2] || 'http://localhost:3000';
const HOUR = 3600e3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch('https://data.gov.il/api/3/action/datastore_search?resource_id=e83f763b-b7d7-479e-b172-ae981ddc6de5&limit=5000');
const rows = (await res.json()).result.records;
const now = Date.now();
const groups = new Map();
for (const r of rows) {
  const t = localToInstant(r.CHPTOL || r.CHSTOL, 'Asia/Jerusalem');
  if (!t || /CANCEL/.test(r.CHRMINE)) continue;
  // המראות: יצאו ב-6 השעות האחרונות. נחיתות: עוד לא נחתו, ואמורות לנחות ב-6 השעות הקרובות
  const airborneDep = r.CHAORD === 'D' && r.CHRMINE === 'DEPARTED' && t > now - 6 * HOUR && t < now - 15 * 60e3;
  const airborneArr = r.CHAORD === 'A' && r.CHRMINE !== 'LANDED' && t > now + 15 * 60e3 && t < now + 6 * HOUR;
  if (!airborneDep && !airborneArr) continue;
  const key = `${r.CHAORD}|${r.CHPTOL}|${r.CHLOC1}`;
  const g = groups.get(key) || [];
  g.push(r); groups.set(key, g);
}
const flights = [...groups.values()].map((g) => g.sort((a, b) => Number(a.CHFLTN) - Number(b.CHFLTN))[0]);
console.log(`טיסות באוויר עכשיו (אחרי איחוד שיתופי קוד): ${flights.length}`);

const results = [];
for (const r of flights) {
  const code = `${r.CHOPER}${Number(r.CHFLTN)}`;
  const date = r.CHSTOL.slice(0, 10);
  const out = { code, dir: r.CHAORD, loc: r.CHLOC1, ptol: r.CHPTOL };
  try {
    const f = await (await fetch(`${BASE}/api/flight?flight=${code}&date=${date}`)).json();
    if (f.error) { out.result = 'flight-error'; out.note = f.error; results.push(out); continue; }
    // טיסה שכבר נחתה ביעד (הלוח של נתב״ג לא מעדכן נחיתה בחו״ל): לא בודקים
    const etaAt = localToInstant(f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone);
    if (f.direction === 'departure' && etaAt && etaAt < Date.now()) { out.result = 'landed'; results.push(out); continue; }
    const callsign = f.callsign || (f.codeshares || []).map((c) => c.callsign).find(Boolean);
    if (!callsign) { out.result = 'no-callsign'; results.push(out); continue; }
    const q = new URLSearchParams({ callsign, reg: f.aircraft?.registration || '' });
    const cs = (f.codeshares || []).map((c) => c.callsign).filter(Boolean);
    if (cs.length) q.set('cs', cs.join(','));
    q.set('from', f.departure.iata); q.set('to', f.arrival.iata); q.set('dir', f.direction || 'departure');
    const eta = localToInstant(f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone);
    const dep = localToInstant(f.departure.actual || f.departure.estimated || f.departure.scheduled, f.departure.timezone);
    if (eta) q.set('eta', String(eta)); if (dep) q.set('dep', String(dep));
    const live = await (await fetch(`${BASE}/api/live?${q}`)).json();
    out.callsign = callsign;
    if (live.found) {
      out.result = live.matchedByRoute ? 'route' : 'callsign';
      out.broadcast = live.broadcastCallsign; out.over = live.view?.over?.name; out.ground = live.live?.isGround;
    } else if (live.estimate) { out.result = 'estimate'; out.over = live.estimate.view?.over?.name; }
    else { out.result = live.error ? 'live-error' : 'nothing'; if (live.error) out.note = live.busy ? 'busy (429)' : live.error; }
  } catch (e) { out.result = 'exception'; out.note = e.message; }
  results.push(out);
  await sleep(Number(process.env.SCAN_DELAY || 2500));
}

const count = (k) => results.filter((x) => x.result === k).length;
console.log(`\nנמצא לפי אות קריאה: ${count('callsign')} · לפי מסלול: ${count('route')} · הערכה לפי זמן: ${count('estimate')} · כלום: ${count('nothing')} · בלי אות קריאה: ${count('no-callsign')} · שגיאות: ${count('flight-error') + count('live-error') + count('exception')} · כבר נחתו: ${count('landed')}`);
for (const x of results) console.log([x.result.padEnd(12), x.code.padEnd(8), x.dir, x.loc, x.ptol.slice(11, 16), x.callsign || '', x.broadcast || '', x.over || '', x.note || ''].join(' | '));
