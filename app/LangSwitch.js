'use client';
import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { pathFor, splitPath } from '../lib/i18n';

// מעבר בין עברית לאנגלית באותו עמוד: /terms <-> /en/terms, כולל קישור לטיסה (?f=)
const OTHER = { he: { lang: 'en', label: 'EN', name: 'English' }, en: { lang: 'he', label: 'עב', name: 'עברית' } };

export default function LangSwitch() {
  const tr = useT();
  const o = OTHER[tr.lang] || OTHER.he;
  const [href, setHref] = useState(pathFor(o.lang, '/'));
  useEffect(() => {
    const { path } = splitPath(window.location.pathname);
    setHref(pathFor(o.lang, path) + window.location.search);
  }, [o.lang]);
  return (
    <a href={href} hrefLang={o.lang} lang={o.lang} className="lang-chip" aria-label={o.name} title={o.name}
      onClick={() => { try { localStorage.setItem('kanaf:lang', o.lang); } catch {} }}>
      {o.label}
    </a>
  );
}
