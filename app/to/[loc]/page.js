import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandBar } from '../../Logo';
import { board, destRows, dayHe, alternates } from '../../../lib/seo';
import { pageT } from '../../../lib/pageLang';

export const dynamic = 'force-dynamic';

async function load(loc, t) {
  try {
    const rows = await board(t);
    const d = destRows(rows, loc);
    const any = rows.find((r) => r.loc === loc);
    if (!any) return null;
    return { ...d, city: any.city, country: any.country };
  } catch { return null; }
}

const hm = (s) => (s || '').slice(11, 16);
const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

export async function generateMetadata({ params }) {
  const t = pageT();
  const loc = clean(params.loc);
  const d = await load(loc, t);
  if (!d) return { title: t('כנף'), robots: { index: false } };
  const title = t('טיסות ל{city} ומ{city} בנתב״ג: היום ומחר · כנף', { city: d.city });
  const description = t('{dep} המראות ל{city} ו-{arr} נחיתות מ{city} ביומיים הקרובים, לפי לוח נתב״ג. שעות, חברות, עיכובים ומעקב חי.', { dep: d.departures.length, arr: d.arrivals.length, city: d.city });
  const alt = alternates(`/to/${loc}`, t.lang);
  const og = t.lang === 'he' ? '/api/og' : `/api/og?lang=${t.lang}`;
  return { title, description, alternates: alt, openGraph: { title, description, url: alt.canonical, siteName: t('כנף'), images: [{ url: og, width: 1200, height: 630 }] } };
}

function List({ items, dep, t }) {
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>{dep ? t('אין המראות ביומיים הקרובים.') : t('אין נחיתות ביומיים הקרובים.')}</p>;
  let last = null;
  return items.map((r) => {
    const day = dayHe(r.ptol, t);
    const show = day !== last; last = day;
    return (
      <div key={r.ptol + r.codes[0]} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {show && <span className="small strong muted">{day}</span>}
        <Link href={t.href(`/flight/${r.codes[0]}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--ground)', color: 'inherit', textDecoration: 'none' }}>
          <span style={{ fontSize: 20, fontWeight: 800, minWidth: 58 }}>{hm(r.ptol)}</span>
          <span style={{ flex: 1 }}><span className="strong">{r.opName} · {r.codes[0]}</span>{r.codes.length > 1 ? <span className="small muted"> · {t('גם {codes}', { codes: r.codes.slice(1).join(', ') })}</span> : null}</span>
          {r.stHe && /CANCEL|DELAY|LANDED|DEPARTED/.test(r.st) ? <span className="small strong">{r.stHe}</span> : null}
        </Link>
      </div>
    );
  });
}

export default async function DestPage({ params }) {
  const t = pageT();
  const loc = clean(params.loc);
  const d = await load(loc, t);
  if (!d) notFound();
  const go = t.dir === 'rtl' ? '←' : '→';
  return (
    <>
      <BrandBar />
      <main className="app" style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 26 }}>{t('טיסות בין תל אביב ל{city}', { city: d.city })}</h1>
        <p className="muted" style={{ margin: 0 }}>{d.country} · {loc} · {t('לפי לוח נתב״ג, היום ומחר')}</p>
        <section className="card big" style={{ gap: 8 }}>
          <h2>🛫 {t('המראות ל{city}', { city: d.city })}</h2>
          <List items={d.departures} dep t={t} />
        </section>
        <section className="card big" style={{ gap: 8 }}>
          <h2>🛬 {t('נחיתות מ{city}', { city: d.city })}</h2>
          <span className="small muted">{t('שעת הנחיתה בנתב״ג')}</span>
          <List items={d.arrivals} t={t} />
        </section>
        <Link href={t.href('/')} style={{ color: 'var(--coral-ink)', fontWeight: 700 }}>{t('לחיפוש טיסה בכנף')} {go}</Link>
        <p className="small muted" style={{ margin: 0 }}>{t('הנתונים מלוח הטיסות של רשות שדות התעופה (data.gov.il) ומתעדכנים כל כמה דקות. המידע אינו רשמי, והשימוש בו באחריות המשתמש בלבד.')} <Link href={t.href('/terms')} style={{ color: 'inherit' }}>{t('תנאי שימוש')}</Link></p>
      </main>
    </>
  );
}
