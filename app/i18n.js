'use client';
import { createContext, useContext, useMemo } from 'react';
import { heT, makeT } from '../lib/i18n';

const Ctx = createContext(heT);

// layout.js שולח לכאן רק את המילון של השפה הנוכחית
export function I18nProvider({ lang, dict, children }) {
  const t = useMemo(() => makeT(lang, dict), [lang, dict]);
  return <Ctx.Provider value={t}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

// מוסיף ?lang= לבקשות ל-API כשהשפה לא עברית, כדי שהודעות ושמות יחזרו בשפה הנכונה
export function apiUrl(t, url) {
  if (!t || t.lang === 'he') return url;
  return url + (url.includes('?') ? '&' : '?') + 'lang=' + t.lang;
}
