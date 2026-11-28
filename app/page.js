import App from './App';
import { iaaFlight } from '../lib/iaa';
import { delayStamp } from '../lib/flightLogic';
import { localizeFlight } from '../lib/localize';
import { alternates, SITE } from '../lib/seo';
import { pageT } from '../lib/pageLang';

const ogImage = (p) => ({ url: `/api/og${p && Object.keys(p).length ? '?' + new URLSearchParams(p) : ''}`, width: 1200, height: 630 });

// כשמשתפים קישור לטיסה (?f=LY315&d=2026-11-25), וואטסאפ מציג כותרת ותיאור של הטיסה עצמה
export async function generateMetadata({ searchParams }) {
  const t = pageT();
  const langQ = t.lang === 'he' ? {} : { lang: t.lang };
  const raw = String(searchParams?.f || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(searchParams?.d || '')) ? String(searchParams.d) : null;
  if (!raw) return { metadataBase: new URL(SITE), alternates: alternates('/', t.lang), openGraph: { title: t('כנף · מלווה טיסה'), description: t('כל המידע על הטיסה שלך, לפני ובזמן הטיסה'), images: [ogImage(langQ)] } };
  let title = t('עקבו אחרי {flight} · כנף', { flight: raw });
  let description = t('מעקב אחרי הטיסה בזמן אמת: איפה המטוס, מתי נוחתים, והאם יש עיכוב.');
  let img = { f: raw, ...langQ };
  try {
    const parts = raw.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
    const code = parts ? parts[1] + String(Number(parts[2])) + parts[3] : raw;
    const r = date ? await iaaFlight(code, date) : null;
    const f = r?.flight && localizeFlight(r.flight, t);
    if (f) {
      const from = f.departure.cityHe || f.departure.iata, to = f.arrival.cityHe || f.arrival.iata;
      title = t('עקבו אחרי {flight}: {from} {arrow} {to}', { flight: f.flight, from, to, arrow: t.dir === 'rtl' ? '←' : '→' });
      const tlvTime = (f.direction === 'departure' ? f.departure.estimated : f.arrival.estimated) || '';
      const dep = f.direction === 'departure';
      const st = delayStamp(f, t);
      const status = st ? [st.title, st.line].filter(Boolean).join(' ') : (f.statusHe || '');
      const tone = st ? (st.kind === 'cancelled' ? 'bad' : 'warn') : /LANDED|DEPARTED|ON TIME|FINAL/.test(f.statusEn || '') ? 'good' : '';
      const kind = dep ? t('המראה') : t('נחיתה');
      description = `${f.airline} · ${kind} ${tlvTime.slice(11, 16)}${status ? ' · ' + status : ''} · ${t('מעקב חי בכנף')}`;
      img = { f: f.flight, a: f.airline || '', from, to, k: kind, t: tlvTime.slice(11, 16), s: status, tone, ...langQ };
    }
  } catch {}
  const images = [ogImage(img)];
  return { metadataBase: new URL(SITE), title, description, openGraph: { title, description, type: 'website', siteName: t('כנף'), images }, twitter: { card: 'summary_large_image', title, description, images } };
}

export default function Page() {
  return <App />;
}
