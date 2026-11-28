import { heT } from './i18n';

// חישובים על היעד, בלי תצוגה
// כמה שעות הפרש בין היעד לישראל, עכשיו (כולל שעון קיץ)
export function offsetMin(tz, at = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(at).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - at) / 60000);
}
// short: בלי "מישראל" ("שעתיים קדימה"), לכרטיס הטיפים
export function diffLabel(tz, t = heT, short = false) {
  if (!tz) return null;
  const d = (offsetMin(tz) - offsetMin('Asia/Jerusalem')) / 60;
  if (d === 0) return t('אותה שעה כמו בישראל');
  const abs = Math.abs(d);
  const h = abs === 1 ? t('שעה') : abs === 2 ? t('שעתיים') : t('{n} שעות', { n: abs % 1 ? abs.toFixed(1) : abs });
  if (short) return d > 0 ? t('{hours} קדימה', { hours: h }) : t('{hours} אחורה', { hours: h });
  return d > 0 ? t('{hours} קדימה מישראל', { hours: h }) : t('{hours} אחורה מישראל', { hours: h });
}

// השעה עכשיו ביעד
export const clockIn = (tz, t = heT) => new Intl.DateTimeFormat(t.locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(Date.now());

// שקע חשמל במילים: האם התקע הישראלי נכנס, או איזה מתאם צריך
export function plugInfo(plugs, t = heT) {
  const types = new Set((plugs.match(/\b[A-O]\b/g) || []));
  const volt = /100V|120V/.test(plugs) ? ' ' + t('המתח נמוך יותר מבישראל, אבל רוב המטענים של טלפונים ומחשבים מתאימים לו.') : '';
  if (types.has('C') || types.has('E') || types.has('F')) {
    return { fits: true, short: t('בלי מתאם'), text: t('התקע הישראלי הרגיל, עם 2 פינים עגולים, נכנס. למכשיר עם 3 פינים צריך מתאם.') + volt };
  }
  if (types.has('G')) return { fits: false, short: t('צריך מתאם'), text: t('צריך מתאם לשקע בריטי, עם 3 פינים מלבניים גדולים.') + volt };
  if (types.has('A') || types.has('B')) return { fits: false, short: t('צריך מתאם'), text: t('צריך מתאם לשקע אמריקאי, עם 2 פינים שטוחים.') + volt };
  if (types.has('I')) return { fits: false, short: t('צריך מתאם'), text: t('צריך מתאם לשקע עם פינים שטוחים באלכסון (כמו באוסטרליה).') + volt };
  if (types.has('D') || types.has('M')) return { fits: false, short: t('צריך מתאם'), text: t('צריך מתאם לשקע עם 3 פינים עגולים גדולים.') + volt };
  return { fits: false, short: t('כדאי מתאם'), text: t('כדאי לקחת מתאם אוניברסלי.') };
}

