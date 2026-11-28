// שפות האתר. הטקסטים בקוד כתובים בעברית, והעברית היא גם המפתח לתרגום (כמו gettext):
// t('עודכן לפני {n} דק׳', { n }) מחפש את המשפט במילון של השפה, ואם אין תרגום משאיר עברית.
// כך הקוד נשאר קריא, ושפה חדשה היא רק קובץ מילון חדש ב-locales/.
import { cloneElement, isValidElement } from 'react';

export const LANGS = ['he', 'en'];
export const DEFAULT_LANG = 'he';
export const DIR = { he: 'rtl', en: 'ltr' };
export const LOCALE = { he: 'he-IL', en: 'en-GB' };
export const OG_LOCALE = { he: 'he_IL', en: 'en_GB' };

export const isLang = (x) => LANGS.includes(x);

// "/terms" -> "/en/terms" באנגלית, ונשאר "/terms" בעברית
export function pathFor(lang, path = '/') {
  const p = path.startsWith('/') ? path : '/' + path;
  if (lang === DEFAULT_LANG) return p;
  return p === '/' ? `/${lang}` : `/${lang}${p}`;
}

// "/en/terms" -> { lang: 'en', path: '/terms' }
export function splitPath(pathname = '/') {
  const m = pathname.match(/^\/([a-z]{2})(?=\/|$)(.*)$/);
  if (m && isLang(m[1]) && m[1] !== DEFAULT_LANG) return { lang: m[1], path: m[2] || '/' };
  return { lang: DEFAULT_LANG, path: pathname || '/' };
}

// מחליף {name} בערכים. אם אחד הערכים הוא רכיב React (למשל <b>), מחזיר מערך שאפשר להציג ב-JSX
export function interp(text, vars) {
  if (!vars) return text;
  const parts = String(text).split(/\{(\w+)\}/);
  if (parts.length === 1) return text;
  let rich = false;
  const out = parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const v = vars[p];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') { rich = true; return isValidElement(v) ? cloneElement(v, { key: `v${i}` }) : v; }
    return String(v);
  });
  return rich ? out.filter((x) => x !== '') : out.join('');
}

// פונקציית תרגום למילון נתון. t.lang הוא קוד השפה, t.raw מתרגם בלי להחליף משתנים
export function makeT(lang, dict) {
  const d = lang === DEFAULT_LANG ? null : dict || null;
  const look = (key) => (d && typeof d[key] === 'string' && d[key] !== '' ? d[key] : key);
  const t = (key, vars) => interp(look(key), vars);
  t.lang = lang;
  t.dir = DIR[lang] || 'rtl';
  t.locale = LOCALE[lang] || LOCALE.he;
  t.raw = look;
  t.has = (key) => !!(d && typeof d[key] === 'string' && d[key] !== '');
  t.href = (path) => pathFor(lang, path);
  return t;
}

// עברית, בלי מילון. ברירת המחדל של כל הפונקציות ב-lib, כדי שהבדיקות והקוד הקיים ימשיכו לעבוד
export const heT = makeT('he', null);

// מתרגם את כל המחרוזות בתוך אובייקט נתונים (קובצי data/*.json)
export function tData(value, t) {
  if (!t || t.lang === DEFAULT_LANG || value == null) return value;
  if (typeof value === 'string') return t.raw(value);
  if (Array.isArray(value)) return value.map((x) => tData(x, t));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = tData(v, t);
    return out;
  }
  return value;
}
