import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandBar } from '../../Logo';
import { board, destRows, dayHe, SITE } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

async function load(loc) {
  try {
    const rows = await board();
    const d = destRows(rows, loc);
    const any = rows.find((r) => r.loc === loc);
    if (!any) return null;
    return { ...d, city: any.city, country: any.country };
  } catch { return null; }
}

const t = (s) => (s || '').slice(11, 16);
const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

export async function generateMetadata({ params }) {
  const loc = clean(params.loc);
  const d = await load(loc);
  if (!d) return { title: 'כנף', robots: { index: false } };
  const title = `טיסות ל${d.city} ומ${d.city} בנתב״ג: היום ומחר · כנף`;
  const description = `${d.departures.length} המראות ל${d.city} ו-${d.arrivals.length} נחיתות מ${d.city} ביומיים הקרובים, לפי לוח נתב״ג. שעות, חברות, עיכובים ומעקב חי.`;
  return { title, description, alternates: { canonical: `${SITE}/to/${loc}` }, openGraph: { title, description, url: `${SITE}/to/${loc}` } };
}

function List({ items, dep }) {
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>אין {dep ? 'המראות' : 'נחיתות'} ביומיים הקרובים.</p>;
  let last = null;
  return items.map((r) => {
    const day = dayHe(r.ptol);
    const show = day !== last; last = day;
    return (
      <div key={r.ptol + r.codes[0]} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {show && <span className="small strong muted">{day}</span>}
        <Link href={`/flight/${r.codes[0]}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--ground)', color: 'inherit', textDecoration: 'none' }}>
          <span style={{ fontSize: 20, fontWeight: 800, minWidth: 58 }}>{t(r.ptol)}</span>
          <span style={{ flex: 1 }}><span className="strong">{r.opName} · {r.codes[0]}</span>{r.codes.length > 1 ? <span className="small muted"> · גם {r.codes.slice(1).join(', ')}</span> : null}</span>
          {r.stHe && /CANCEL|DELAY|LANDED|DEPARTED/.test(r.st) ? <span className="small strong">{r.stHe}</span> : null}
        </Link>
      </div>
    );
  });
}

export default async function DestPage({ params }) {
  const loc = clean(params.loc);
  const d = await load(loc);
  if (!d) notFound();
  return (
    <>
      <BrandBar />
      <main className="app" style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 26 }}>טיסות בין תל אביב ל{d.city}</h1>
        <p className="muted" style={{ margin: 0 }}>{d.country} · {loc} · לפי לוח נתב״ג, היום ומחר</p>
        <section className="card big" style={{ gap: 8 }}>
          <h2>🛫 המראות ל{d.city}</h2>
          <List items={d.departures} dep />
        </section>
        <section className="card big" style={{ gap: 8 }}>
          <h2>🛬 נחיתות מ{d.city}</h2>
          <span className="small muted">שעת הנחיתה בנתב״ג</span>
          <List items={d.arrivals} />
        </section>
        <Link href="/" style={{ color: 'var(--coral-ink)', fontWeight: 700 }}>לחיפוש טיסה בכנף ←</Link>
        <p className="small muted" style={{ margin: 0 }}>הנתונים מלוח הטיסות של רשות שדות התעופה (data.gov.il) ומתעדכנים כל כמה דקות.</p>
      </main>
    </>
  );
}
