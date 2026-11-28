import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandBar } from '../../Logo';
import { board, flightRows, codesharesOf, normCode, dayHe, alternates, SITE } from '../../../lib/seo';
import { pageT } from '../../../lib/pageLang';

export const dynamic = 'force-dynamic';

async function load(code, t) {
  try {
    const rows = await board(t);
    const { main } = flightRows(rows, code);
    if (!main) return null;
    return { r: main, cs: codesharesOf(rows, main) };
  } catch { return null; }
}

const hm = (s) => (s || '').slice(11, 16);

export async function generateMetadata({ params }) {
  const t = pageT();
  const code = normCode(params.code);
  const d = await load(code, t);
  if (!d) return { title: `${code} · ${t('כנף')}`, robots: { index: false } };
  const { r } = d;
  const dep = r.dir === 'D';
  const tlv = t('תל אביב');
  const title = dep
    ? t('{code} מתל אביב ל{city}: סטטוס הטיסה בזמן אמת · כנף', { code, city: r.city })
    : t('{code} מ{city} לתל אביב: סטטוס הטיסה בזמן אמת · כנף', { code, city: r.city });
  const when = dep ? t('המראה מנתב״ג {day} ב-{time}', { day: dayHe(r.stol, t), time: hm(r.ptol) }) : t('נחיתה בנתב״ג {day} ב-{time}', { day: dayHe(r.stol, t), time: hm(r.ptol) });
  const description = `${r.opName} ${code} · ${when}${r.stHe ? ` · ${r.stHe}` : ''}${r.term ? ` · ${t('טרמינל {n}', { n: r.term })}` : ''}. ${t('מעקב חי, מתי להגיע לשדה ומתי לבוא לאסוף.')}`;
  const img = `/api/og?${new URLSearchParams({ f: code, a: r.opName || '', from: dep ? tlv : r.city, to: dep ? r.city : tlv, k: dep ? t('המראה') : t('נחיתה'), t: hm(r.ptol || r.stol), s: r.stHe || '', ...(t.lang === 'he' ? {} : { lang: t.lang }) })}`;
  const alt = alternates(`/flight/${code}`, t.lang);
  return { title, description, alternates: alt, openGraph: { title, description, url: alt.canonical, siteName: t('כנף'), images: [{ url: img, width: 1200, height: 630 }] } };
}

export default async function FlightPage({ params }) {
  const t = pageT();
  const code = normCode(params.code);
  const d = await load(code, t);
  if (!d) notFound();
  const { r, cs } = d;
  const dep = r.dir === 'D';
  const moved = r.ptol && r.stol && r.ptol !== r.stol;
  const live = `${t.href('/')}?f=${encodeURIComponent(code)}&d=${r.stol.slice(0, 10)}`;
  const go = t.dir === 'rtl' ? '←' : '→';
  const tlv = t('תל אביב');
  return (
    <>
      <BrandBar />
      <main className="app" style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 26 }}>{t('טיסה {code}: {route}', { code, route: dep ? `${tlv} ${go} ${r.city}` : `${r.city} ${go} ${tlv}` })}</h1>
        <p className="muted" style={{ margin: 0 }}>{r.opName} · {dep ? t('המראה מנתב״ג') : t('נחיתה בנתב״ג')} {dayHe(r.stol, t)}</p>
        <section className="card big" style={{ gap: 10 }}>
          <div className="row"><span className="muted">{dep ? t('שעת המראה') : t('שעת נחיתה')}</span><span className="strong" style={{ fontSize: 22 }}>{hm(r.ptol || r.stol)}</span></div>
          {moved && <div className="row"><span className="muted">{t('שעה מתוכננת')}</span><span className="strong">{hm(r.stol)}</span></div>}
          {r.stHe && <div className="row"><span className="muted">{t('סטטוס')}</span><span className="strong">{r.stHe}</span></div>}
          {r.term && <div className="row"><span className="muted">{t('טרמינל')}</span><span className="strong">{r.term}</span></div>}
          {dep && r.cin && <div className="row"><span className="muted">{t('דלפקי צ׳ק-אין')}</span><span className="strong">{r.cin}{r.zone ? ` · ${t('אזור {zone}', { zone: r.zone })}` : ''}</span></div>}
          {cs.length > 0 && <p style={{ margin: 0, fontSize: 14 }}>{t('טיסה משותפת: אותה טיסה נמכרת גם בתור {codes}.', { codes: cs.join(', ') })}</p>}
          <Link href={live} className="btn-sun" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>{t('למעקב חי אחרי {code}', { code })} {go}</Link>
        </section>
        <p style={{ margin: 0, fontSize: 15 }}>
          {dep
            ? t('במעקב החי בכנף רואים איפה המטוס עכשיו, מתי להגיע לשדה ומה כדאי לדעת על {city}.', { city: r.city })
            : t('במעקב החי בכנף רואים איפה המטוס עכשיו, מתי לבוא לאסוף ומתי הנוסעים יוצאים מהטרמינל.')}
        </p>
        <Link href={t.href(`/to/${r.loc}`)} style={{ color: 'var(--coral-ink)', fontWeight: 700 }}>{dep ? t('כל הטיסות ל{city}', { city: r.city }) : t('כל הטיסות מ{city}', { city: r.city })} {go}</Link>
        <p className="small muted" style={{ margin: 0 }}>{t('הנתונים מלוח הטיסות של רשות שדות התעופה (data.gov.il) ומתעדכנים כל כמה דקות. המידע אינו רשמי, והשימוש בו באחריות המשתמש בלבד.')} <Link href={t.href('/terms')} style={{ color: 'inherit' }}>{t('תנאי שימוש')}</Link> {t('השעה הקובעת היא זו שבכרטיס ובהודעות של חברת התעופה.')}</p>
      </main>
    </>
  );
}
