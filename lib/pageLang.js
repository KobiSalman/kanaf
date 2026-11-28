// השפה של העמוד הנוכחי בשרת, לפי הכתובת (/en/...), דרך middleware.js
import { headers } from 'next/headers';
import { DEFAULT_LANG, isLang } from './i18n';
import { getT } from './i18nServer';

export function pageLang() {
  try {
    const l = headers().get('x-kanaf-lang');
    return isLang(l) ? l : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export const pageT = () => getT(pageLang());
