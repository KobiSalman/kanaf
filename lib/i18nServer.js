// המילונים נטענים רק בשרת. הדפדפן מקבל רק את המילון של השפה שבה הוא גולש (דרך layout.js)
import EN_UI from '../locales/en.json';
import EN_DATA from '../locales/en.data.json';
import { DEFAULT_LANG, isLang, makeT } from './i18n';

const DICTS = { en: { ...EN_DATA, ...EN_UI } };

export function dictFor(lang) {
  return lang === DEFAULT_LANG ? null : DICTS[lang] || null;
}

export function getT(lang) {
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  return makeT(l, dictFor(l));
}

// השפה של בקשה ל-API: ?lang=en (הדפדפן מוסיף אותו רק כשהוא לא בעברית)
export function langOf(request) {
  try {
    const l = new URL(request.url).searchParams.get('lang');
    return isLang(l) ? l : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export const tOf = (request) => getT(langOf(request));
