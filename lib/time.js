import { heT } from './i18n';

// Aviationstack מחזיר שעות מקומיות של כל שדה תעופה, אבל מסמן אותן כ-UTC (+00:00).
// הפונקציות כאן מתקנות את זה.

// "2026-11-23T09:10:00+00:00" -> "09:10"
export function hhmm(value) {
  if (!value) return null;
  return value.slice(11, 16);
}

function tzOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

// שעה מקומית של שדה התעופה -> רגע אמיתי (מילישניות)
export function localToInstant(value, timeZone) {
  if (!value || !timeZone) return null;
  const naive = Date.UTC(
    Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)),
    Number(value.slice(11, 13)), Number(value.slice(14, 16)), Number(value.slice(17, 19) || 0)
  );
  const first = naive - tzOffsetMs(naive, timeZone);
  return naive - tzOffsetMs(first, timeZone);
}

export function todayIn(timeZone = 'Asia/Jerusalem') {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

export function minutesLabel(min, t = heT) {
  if (min >= 60) return t('{h}:{m} שע׳', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
  return t('{n} דק׳', { n: min });
}

export function agoLabel(ms, t = heT) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  if (sec < 10) return t('עודכן עכשיו');
  if (min < 1) return t('עודכן לפני {n} שנ׳', { n: sec });
  if (min < 60) return t('עודכן לפני {n} דק׳', { n: min });
  return t('עודכן לפני {n} שע׳', { n: Math.floor(min / 60) });
}
