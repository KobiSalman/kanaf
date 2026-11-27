import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandBar } from '../../Logo';
import { board, flightRows, codesharesOf, normCode, dayHe, SITE } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

async function load(code) {
  try {
    const rows = await board();
    const { main } = flightRows(rows, code);
    if (!main) return null;
    return { r: main, cs: codesharesOf(rows, main) };
  } catch { return null; }
}

const t = (s) => (s || '').slice(11, 16);

export async function generateMetadata({ params }) {
  const code = normCode(params.code);
  const d = await load(code);
  if (!d) return { title: `${code} · כנף`, robots: { index: false } };
  const { r } = d;
  const dep = r.dir === 'D';
  const title = dep ? `${code} מתל אביב ל${r.city}: סטטוס הטיסה בזמן אמת · כנף` : `${code} מ${r.city} לתל אביב: סטטוס הטיסה בזמן אמת · כנף`;
  const description = `${r.opName} ${code} · ${dep ? 'המראה מנתב״ג' : 'נחיתה בנתב״ג'} ${dayHe(r.stol)} ב-${t(r.ptol)}${r.stHe ? ` · ${r.stHe}` : ''}${r.term ? ` · טרמינל ${r.term}` : ''}. מעקב חי, מתי להגיע לשדה ומתי לבוא לאסוף.`;
  const img = `/api/og?${new URLSearchParams({ f: code, a: r.opName || '', from: dep ? 'תל אביב' : r.city, to: dep ? r.city : 'תל אביב', k: dep ? 'המראה' : 'נחיתה', t: t(r.ptol || r.stol), s: r.stHe || '' })}`;
  return { title, description, alternates: { canonical: `${SITE}/flight/${code}` }, openGraph: { title, description, url: `${SITE}/flight/${code}`, siteName: 'כנף', images: [{ url: img, width: 1200, height: 630 }] } };
}

export default async function FlightPage({ params }) {
  const code = normCode(params.code);
  const d = await load(code);
  if (!d) notFound();
  const { r, cs } = d;
  const dep = r.dir === 'D';
  const moved = r.ptol && r.stol && r.ptol !== r.stol;
  const live = `/?f=${encodeURIComponent(code)}&d=${r.stol.slice(0, 10)}`;
  return (
    <>
      <BrandBar />
      <main className="app" style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 26 }}>טיסה {code}: {dep ? `תל אביב ← ${r.city}` : `${r.city} ← תל אביב`}</h1>
        <p className="muted" style={{ margin: 0 }}>{r.opName} · {dep ? 'המראה מנתב״ג' : 'נחיתה בנתב״ג'} {dayHe(r.stol)}</p>
        <section className="card big" style={{ gap: 10 }}>
          <div className="row"><span className="muted">{dep ? 'שעת המראה' : 'שעת נחיתה'}</span><span className="strong" style={{ fontSize: 22 }}>{t(r.ptol || r.stol)}</span></div>
          {moved && <div className="row"><span className="muted">שעה מתוכננת</span><span className="strong">{t(r.stol)}</span></div>}
          {r.stHe && <div className="row"><span className="muted">סטטוס</span><span className="strong">{r.stHe}</span></div>}
          {r.term && <div className="row"><span className="muted">טרמינל</span><span className="strong">{r.term}</span></div>}
          {dep && r.cin && <div className="row"><span className="muted">דלפקי צ׳ק-אין</span><span className="strong">{r.cin}{r.zone ? ` · אזור ${r.zone}` : ''}</span></div>}
          {cs.length > 0 && <p style={{ margin: 0, fontSize: 14 }}>טיסה משותפת: אותה טיסה נמכרת גם בתור {cs.join(', ')}.</p>}
          <Link href={live} className="btn-sun" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>למעקב חי אחרי {code} ←</Link>
        </section>
        <p style={{ margin: 0, fontSize: 15 }}>
          במעקב החי בכנף רואים איפה המטוס עכשיו, {dep ? 'מתי להגיע לשדה ומה כדאי לדעת על ' + r.city : 'מתי לבוא לאסוף ומתי הנוסעים יוצאים מהטרמינל'}.
        </p>
        <Link href={`/to/${r.loc}`} style={{ color: 'var(--coral-ink)', fontWeight: 700 }}>כל הטיסות {dep ? 'ל' : 'מ'}{r.city} ←</Link>
        <p className="small muted" style={{ margin: 0 }}>הנתונים מלוח הטיסות של רשות שדות התעופה (data.gov.il) ומתעדכנים כל כמה דקות. השעה הקובעת היא זו שבכרטיס ובהודעות של חברת התעופה.</p>
      </main>
    </>
  );
}
