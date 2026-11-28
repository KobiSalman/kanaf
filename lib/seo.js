// עמודים לגוגל: טיסה ויעד מתוך לוח נתב״ג (בלי מיקום חי, כדי לא לבזבז מכסות)
import { fullBoard } from './iaa';
import { localToInstant } from './time';
import { heT, pathFor, LANGS } from './i18n';
import { localizeRow } from './localize';

export const SITE = 'https://kanaf-seven.vercel.app';
const H = 3600e3;

export const flightCode = (r) => `${r.op}${r.no}`;
export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const at = (r) => localToInstant(r.ptol || r.stol, 'Asia/Jerusalem');

// השורות של טיסה אחת בלוח, מהקרובה ביותר שעוד לא עברה (או האחרונה שעברה)
export function flightRows(rows, code, now = Date.now()) {
  const mine = rows.filter((r) => flightCode(r) === code).sort((a, b) => at(a) - at(b));
  if (!mine.length) return { main: null, others: [] };
  const main = mine.find((r) => at(r) > now - 2 * H) || mine.at(-1);
  return { main, others: mine.filter((r) => r !== main) };
}

// טיסות נוספות שהן אותה טיסה (שיתוף קוד): אותה שעה, אותו יעד, אותו כיוון
export function codesharesOf(rows, r) {
  return rows.filter((x) => x !== r && x.dir === r.dir && x.ptol === r.ptol && x.loc === r.loc).map(flightCode);
}

// טיסות ליעד ומהיעד: מחצי שעה אחורה ועד 48 שעות קדימה, שיתופי קוד כשורה אחת
export function destRows(rows, loc, now = Date.now()) {
  const pick = (dir) => {
    const seen = new Map();
    for (const r of rows) {
      if (r.loc !== loc || r.dir !== dir) continue;
      const t = at(r);
      if (!t || t < now - 0.5 * H || t > now + 48 * H) continue;
      const k = r.ptol;
      if (!seen.has(k)) seen.set(k, { ...r, codes: [] });
      seen.get(k).codes.push(flightCode(r));
    }
    return [...seen.values()].sort((a, b) => at(a) - at(b));
  };
  return { departures: pick('D'), arrivals: pick('A') };
}

export async function board(t = heT) {
  const rows = (await fullBoard()).rows;
  return t.lang === 'he' ? rows : rows.map((r) => localizeRow(r, t));
}

// כתובת קנונית ותגיות hreflang לכל השפות
export function alternates(path, lang = 'he') {
  const languages = Object.fromEntries(LANGS.map((l) => [l, SITE + pathFor(l, path)]));
  return { canonical: SITE + pathFor(lang, path), languages: { ...languages, 'x-default': SITE + path } };
}

export const dayHe = (iso, t = heT) => {
  const fmt = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(ms);
  const d = iso.slice(0, 10);
  if (d === fmt(Date.now())) return t('היום');
  if (d === fmt(Date.now() + 864e5)) return t('מחר');
  if (d === fmt(Date.now() - 864e5)) return t('אתמול');
  return t.lang === 'he' ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}` : `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
};
