// חישובי שדה התעופה, בלי תצוגה: עומס, מתי להיות בשדה, מתי הנוסע יוצא
import { heT } from './i18n';

const HOUR = 3600e3, MIN = 60e3;
export const floor15 = (ms) => Math.floor(ms / (15 * MIN)) * 15 * MIN;
export const ceil5 = (ms) => Math.ceil(ms / (5 * MIN)) * 5 * MIN;

const bucket = (crowd, t) => crowd?.hours?.find((h) => t >= h.t && t < h.t + HOUR);

// עומס בצ׳ק-אין בשעה מסוימת: לפי הטיסות שממריאות כשלוש שעות אחר כך (2 עד 4 שעות, עם משקל)
export function checkinLoad(crowd, t) {
  if (!crowd) return null;
  const d = (h) => bucket(crowd, t + h * HOUR)?.dep ?? null;
  const [a, b, c] = [d(2), d(3), d(4)];
  if (b == null) return null;
  return ((a ?? b) * 0.5 + b + (c ?? b) * 0.5) / 2;
}

// כמה מטוסים נוחתים בסביבת שעת הנחיתה (שעה לפני ושעה אחרי, עם משקל)
export function arrivalLoad(crowd, t) {
  if (!crowd) return null;
  const n = (h) => bucket(crowd, t + h * HOUR)?.arr ?? null;
  const [a, b, c] = [n(-1), n(0), n(1)];
  if (b == null) return null;
  return ((a ?? b) * 0.5 + b + (c ?? b) * 0.5) / 2;
}

export function levelOf(n, t = heT) {
  if (n == null) return null;
  if (n >= 12) return { key: 'high', text: t('עמוס'), color: '#B4471F', bg: '#FFD9D2' };
  if (n >= 7) return { key: 'mid', text: t('בינוני'), color: '#7A5A00', bg: '#FFF3C4' };
  return { key: 'low', text: t('רגוע'), color: '#0B5A33', bg: '#C8F5DC' };
}


// טיסה שממריאה: 3 שעות לפני (לאילת שעתיים), ועוד חצי שעה כשצפוי עומס בצ׳ק-אין. מעוגל לרבע שעה
export function leaveTarget(f, dep, crowd) {
  // 3 שעות לפני (לאילת שעתיים), ועוד חצי שעה כשצפוי עומס בצ׳ק-אין
  const domestic = f.arrival.iata === 'ETM' || f.arrival.iata === 'EIL';
  const raw = dep - (domestic ? 2 : 3) * HOUR;
  const extra = !domestic && levelOf(checkinLoad(crowd, raw))?.key === 'high' ? 30 : 0;
  return floor15(raw - extra * MIN);
}

// טיסה שנוחתת: הנוסע יוצא כ-30 דקות אחרי הנחיתה, ועוד 10 או 20 דקות כשהרבה מטוסים נוחתים יחד
export function pickupTarget(land, crowd) {
  // יציאה מהטרמינל: ירידה מהמטוס, ביקורת גבולות ומזוודות. כ-30 דקות, יותר כשהרבה מטוסים נוחתים יחד
  const lv = levelOf(arrivalLoad(crowd, land));
  const add = lv?.key === 'high' ? 20 : lv?.key === 'mid' ? 10 : 0;
  return ceil5(land + (30 + add) * MIN);
}

// ---------- זמן המתנה משוער בבידוק ובביקורת הדרכונים ----------
// אין מקור רשמי לזמני התורים בנתב״ג, אז זו הערכה: כמה טיסות ממריאות מאותו טרמינל
// כשעתיים עד ארבע שעות אחרי שהנוסע מגיע (אז הנוסעים שלהן עומדים איתו בתור),
// ביחס למה שנחשב "עמוס" באותו טרמינל. מכויל לפי הנתונים שרשות שדות התעופה פרסמה:
// פחות מ-15 דקות בשעות רגועות, וכ-35 דקות לבידוק ולרישום בשעות העמוסות.
// טרמינל 1 קטן יותר, אז בו פחות טיסות כבר נחשבות עומס
export const TERM_BUSY = { 1: 6, 3: 14 };
const ALL_BUSY = 18;

export function terminalLoad(crowd, t, term) {
  if (!crowd) return null;
  const key = term && TERM_BUSY[term] ? String(term) : null;
  const d = (h) => {
    const b = bucket(crowd, t + h * HOUR);
    if (!b) return null;
    return key ? (b.term?.[key] ?? 0) : b.dep;
  };
  const [a, b, c] = [d(2), d(3), d(4)];
  if (b == null) return null;
  return ((a ?? b) * 0.5 + b + (c ?? b) * 0.5) / 2;
}

const down5 = (m) => Math.max(5, Math.floor(m / 5) * 5);
const up5 = (m) => Math.ceil(m / 5) * 5;

// מחזיר טווחים בדקות: { security: [מ, עד], passport: [מ, עד] | null, total: [מ, עד], ratio }
export function queueEstimate(crowd, t, { term, domestic = false } = {}) {
  const n = terminalLoad(crowd, t, term);
  if (n == null) return null;
  const busy = TERM_BUSY[term] || ALL_BUSY;
  const ratio = n / busy; // 1 = עמוס רגיל
  const sec = 7 + 27 * ratio;
  const security = [down5(sec * 0.8), Math.max(down5(sec * 0.8) + 5, up5(sec * 1.25))];
  const pas = 4 + 8 * ratio;
  // טיסה פנימית (אילת): אין ביקורת דרכונים
  const passport = domestic ? null : [Math.max(3, Math.round(pas * 0.7)), Math.max(5, Math.round(pas * 1.3))];
  const total = [security[0] + (passport ? passport[0] : 0), security[1] + (passport ? passport[1] : 0)];
  return { security, passport, total, ratio, flights: Math.round(n * 2), term: term && TERM_BUSY[term] ? String(term) : null };
}
