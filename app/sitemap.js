import { board, flightCode, SITE } from '../lib/seo';
import { LANGS, pathFor } from '../lib/i18n';

// מפת אתר לגוגל: העמוד הראשי, כל היעדים וכל הטיסות שבלוח נתב״ג
export const dynamic = 'force-dynamic';

// כל עמוד מופיע בכל השפות (/terms ו-/en/terms)
const entry = (path, changeFrequency, priority) => LANGS.map((l) => ({
  url: SITE + (path === '/' && l === 'he' ? '' : pathFor(l, path)), changeFrequency, priority,
  alternates: { languages: Object.fromEntries(LANGS.map((x) => [x, SITE + pathFor(x, path)])) }
}));

export default async function sitemap() {
  const base = [...entry('/', 'daily', 1), ...entry('/terms', 'monthly', 0.2), ...entry('/accessibility', 'monthly', 0.2)];
  let rows = [];
  try { rows = await board(); } catch { return base; }
  const locs = [...new Set(rows.map((r) => r.loc).filter(Boolean))];
  const codes = [...new Set(rows.map(flightCode))];
  return [
    ...base,
    ...locs.flatMap((l) => entry(`/to/${l}`, 'hourly', 0.7)),
    ...codes.flatMap((c) => entry(`/flight/${c}`, 'hourly', 0.5))
  ];
}
