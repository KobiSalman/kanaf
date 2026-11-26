// חישובים על היעד, בלי תצוגה
// כמה שעות הפרש בין היעד לישראל, עכשיו (כולל שעון קיץ)
export function offsetMin(tz, at = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(at).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - at) / 60000);
}
export function diffLabel(tz) {
  if (!tz) return null;
  const d = (offsetMin(tz) - offsetMin('Asia/Jerusalem')) / 60;
  if (d === 0) return 'אותה שעה כמו בישראל';
  const abs = Math.abs(d);
  const h = abs === 1 ? 'שעה' : abs === 2 ? 'שעתיים' : `${abs % 1 ? abs.toFixed(1) : abs} שעות`;
  return d > 0 ? `${h} קדימה מישראל` : `${h} אחורה מישראל`;
}

// השעה עכשיו ביעד
export const clockIn = (tz) => new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(Date.now());

// שקע חשמל במילים: האם התקע הישראלי נכנס, או איזה מתאם צריך
export function plugInfo(plugs) {
  const t = new Set((plugs.match(/\b[A-O]\b/g) || []));
  const volt = /100V|120V/.test(plugs) ? ' המתח נמוך יותר מבישראל, אבל רוב המטענים של טלפונים ומחשבים מתאימים לו.' : '';
  if (t.has('C') || t.has('E') || t.has('F')) {
    return { fits: true, short: 'בלי מתאם', text: `התקע הישראלי הרגיל, עם 2 פינים עגולים, נכנס. למכשיר עם 3 פינים צריך מתאם.${volt}` };
  }
  if (t.has('G')) return { fits: false, short: 'צריך מתאם', text: `צריך מתאם לשקע בריטי, עם 3 פינים מלבניים גדולים.${volt}` };
  if (t.has('A') || t.has('B')) return { fits: false, short: 'צריך מתאם', text: `צריך מתאם לשקע אמריקאי, עם 2 פינים שטוחים.${volt}` };
  if (t.has('D') || t.has('M')) return { fits: false, short: 'צריך מתאם', text: `צריך מתאם לשקע עם 3 פינים עגולים גדולים.${volt}` };
  return { fits: false, short: 'כדאי מתאם', text: 'כדאי לקחת מתאם אוניברסלי.' };
}

