import App from './App';
import { iaaFlight } from '../lib/iaa';
import { delayStamp } from '../lib/flightLogic';

import { SITE } from '../lib/seo';
const ogImage = (p) => ({ url: `/api/og${p ? '?' + new URLSearchParams(p) : ''}`, width: 1200, height: 630 });

// כשמשתפים קישור לטיסה (?f=LY315&d=2026-11-25), וואטסאפ מציג כותרת ותיאור של הטיסה עצמה
export async function generateMetadata({ searchParams }) {
  const raw = String(searchParams?.f || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(searchParams?.d || '')) ? String(searchParams.d) : null;
  if (!raw) return { metadataBase: new URL(SITE), openGraph: { title: 'כנף · מלווה טיסה', description: 'כל המידע על הטיסה שלך, לפני ובזמן הטיסה', images: [ogImage()] } };
  let title = `עקבו אחרי ${raw} · כנף`;
  let description = 'מעקב אחרי הטיסה בזמן אמת: איפה המטוס, מתי נוחתים, והאם יש עיכוב.';
  let img = { f: raw };
  try {
    const parts = raw.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
    const code = parts ? parts[1] + String(Number(parts[2])) + parts[3] : raw;
    const r = date ? await iaaFlight(code, date) : null;
    const f = r?.flight;
    if (f) {
      const from = f.departure.cityHe || f.departure.iata, to = f.arrival.cityHe || f.arrival.iata;
      title = `עקבו אחרי ${f.flight}: ${from} ← ${to}`;
      const tlvTime = (f.direction === 'departure' ? f.departure.estimated : f.arrival.estimated) || '';
      const dep = f.direction === 'departure';
      const st = delayStamp(f);
      const status = st ? [st.title, st.line].filter(Boolean).join(' ') : (f.statusHe || '');
      const tone = st ? (st.title === 'בוטלה' ? 'bad' : 'warn') : /נחת|המריא|בזמן|סופי/.test(status) ? 'good' : '';
      description = `${f.airline} · ${dep ? 'המראה' : 'נחיתה'} ${tlvTime.slice(11, 16)}${status ? ' · ' + status : ''} · מעקב חי בכנף`;
      img = { f: f.flight, a: f.airline || '', from, to, k: dep ? 'המראה' : 'נחיתה', t: tlvTime.slice(11, 16), s: status, tone };
    }
  } catch {}
  const images = [ogImage(img)];
  return { metadataBase: new URL(SITE), title, description, openGraph: { title, description, type: 'website', siteName: 'כנף', images }, twitter: { card: 'summary_large_image', title, description, images } };
}

export default function Page() {
  return <App />;
}
