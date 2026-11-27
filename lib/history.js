// היסטוריית דיוק: שומרים כל טיסה שהסתיימה (המריאה, נחתה או בוטלה) מלוח נתב״ג.
// הלוח עצמו מחזיק רק כ-24 שעות אחורה, ולכן שומרים לפחות פעם ביום (cron) וגם כשהלוח נטען (לכל היותר פעם ב-12 שעות).
// מבנה: hist:<חברה><מספר><D|A> → hash של תאריך (שעון ישראל) → "<דקות עיכוב>|<D|L|X>"
import { redisPipeline, redisCmd } from './cache';
import { localToInstant } from './time';

const RUN_EVERY_S = 12 * 3600;
const FINAL = { DEPARTED: 'D', LANDED: 'L', CANCELED: 'X', CANCELLED: 'X' };

export const histKey = (op, no, dir) => `hist:${op}${no}${dir}`;

// row: שורה מקוצרת של הלוח (slimRow)
export function histEntry(row) {
  const st = FINAL[row.st];
  if (!st || !row.stol) return null;
  const s = localToInstant(row.stol, 'Asia/Jerusalem'), p = localToInstant(row.ptol || row.stol, 'Asia/Jerusalem');
  const delay = st === 'X' || !s || !p ? 0 : Math.round((p - s) / 60000);
  return { key: histKey(row.op, row.no, row.dir), field: row.stol.slice(0, 10), value: `${delay}|${st}` };
}

export async function archiveBoard(rows, { force = false } = {}) {
  if (!force) {
    try { if ((await redisCmd(['SET', 'hist:run', '1', 'NX', 'EX', String(RUN_EVERY_S)])) !== 'OK') return { skipped: true }; } catch { return { skipped: true }; }
  }
  const byKey = new Map();
  for (const r of rows) {
    const e = histEntry(r);
    if (!e) continue;
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e.field, e.value);
  }
  const cmds = [];
  // פקודה אחת לכל טיסה, כדי לחסוך במכסת הפקודות של Upstash. כל hash גדל בשורה אחת ביום, וזה זניח
  for (const [k, fv] of byKey) cmds.push(['HSET', k, ...fv]);
  for (let i = 0; i < cmds.length; i += 400) await redisPipeline(cmds.slice(i, i + 400));
  return { flights: byKey.size, at: new Date().toISOString() };
}

// סטטיסטיקה: כמה טיסות נשמרו, כמה בזמן (עיכוב פחות מ-15 דקות), עיכוב ממוצע בטיסות שאיחרו, ביטולים
export function summarize(hash, { sinceDays = 60, today = new Date().toISOString().slice(0, 10) } = {}) {
  const from = new Date(Date.parse(today) - sinceDays * 86400e3).toISOString().slice(0, 10);
  const items = Object.entries(hash || {})
    .filter(([d]) => d >= from)
    .map(([date, v]) => { const [m, st] = String(v).split('|'); return { date, delay: Number(m) || 0, cancelled: st === 'X' }; })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const flown = items.filter((x) => !x.cancelled);
  const late = flown.filter((x) => x.delay >= 15);
  return {
    n: items.length,
    onTime: flown.length - late.length,
    late: late.length,
    cancelled: items.length - flown.length,
    avgLate: late.length ? Math.round(late.reduce((a, x) => a + x.delay, 0) / late.length) : 0,
    maxLate: late.length ? Math.max(...late.map((x) => x.delay)) : 0,
    recent: items.slice(0, 10)
  };
}

export async function flightHistory(op, no, dir) {
  const raw = await redisCmd(['HGETALL', histKey(op, no, dir)]);
  const hash = {};
  if (Array.isArray(raw)) for (let i = 0; i < raw.length; i += 2) hash[raw[i]] = raw[i + 1];
  else if (raw && typeof raw === 'object') Object.assign(hash, raw);
  return summarize(hash);
}

export const MIN_FLIGHTS = 5;

// משפט אחד בעברית פשוטה. null אם אין מספיק טיסות כדי להגיד משהו אמין
export function historyText(h) {
  if (!h || h.n < MIN_FLIGHTS) return null;
  const flown = h.n - h.cancelled;
  const pct = flown ? Math.round((h.onTime / flown) * 100) : 0;
  const tone = h.cancelled >= 2 || pct < 50 ? 'warn' : pct >= 80 ? 'good' : '';
  const title = pct >= 80 ? 'בדרך כלל בזמן' : pct >= 50 ? 'לפעמים מאחרת' : 'לרוב מאחרת';
  const parts = [`${h.onTime} מתוך ${flown} הטיסות האחרונות יצאו בזמן (פחות מ-15 דק׳ איחור).`];
  if (h.late) parts.push(`כשהיא איחרה, זה היה בממוצע ${h.avgLate} דק׳.`);
  if (h.cancelled) parts.push(h.cancelled === 1 ? 'טיסה אחת בוטלה.' : `${h.cancelled} טיסות בוטלו.`);
  return { title, tone, pct, text: parts.join(' ') };
}
