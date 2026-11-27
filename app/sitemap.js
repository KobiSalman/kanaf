import { board, flightCode, SITE } from '../lib/seo';

// מפת אתר לגוגל: העמוד הראשי, כל היעדים וכל הטיסות שבלוח נתב״ג
export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const base = [{ url: SITE, changeFrequency: 'daily', priority: 1 }, { url: `${SITE}/terms`, changeFrequency: 'monthly', priority: 0.2 }, { url: `${SITE}/accessibility`, changeFrequency: 'monthly', priority: 0.2 }];
  let rows = [];
  try { rows = await board(); } catch { return base; }
  const locs = [...new Set(rows.map((r) => r.loc).filter(Boolean))];
  const codes = [...new Set(rows.map(flightCode))];
  return [
    ...base,
    ...locs.map((l) => ({ url: `${SITE}/to/${l}`, changeFrequency: 'hourly', priority: 0.7 })),
    ...codes.map((c) => ({ url: `${SITE}/flight/${c}`, changeFrequency: 'hourly', priority: 0.5 }))
  ];
}
