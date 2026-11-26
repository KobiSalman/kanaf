import App from './App';
import { iaaFlight } from '../lib/iaa';

// כשמשתפים קישור לטיסה (?f=LY315&d=2026-11-25), וואטסאפ מציג כותרת ותיאור של הטיסה עצמה
export async function generateMetadata({ searchParams }) {
  const raw = String(searchParams?.f || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(searchParams?.d || '')) ? String(searchParams.d) : null;
  if (!raw) return {};
  let title = `עקבו אחרי ${raw} · כנף`;
  let description = 'מעקב אחרי הטיסה בזמן אמת: איפה המטוס, מתי נוחתים, והאם יש עיכוב.';
  try {
    const parts = raw.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
    const code = parts ? parts[1] + String(Number(parts[2])) + parts[3] : raw;
    const r = date ? await iaaFlight(code, date) : null;
    const f = r?.flight;
    if (f) {
      const from = f.departure.cityHe || f.departure.iata, to = f.arrival.cityHe || f.arrival.iata;
      title = `עקבו אחרי ${f.flight}: ${from} ← ${to}`;
      const tlvTime = (f.direction === 'departure' ? f.departure.estimated : f.arrival.estimated) || '';
      description = `${f.airline} · ${f.direction === 'departure' ? 'המראה' : 'נחיתה'} ${tlvTime.slice(11, 16)} · ${f.statusHe || ''} · מעקב חי בכנף`;
    }
  } catch {}
  return { title, description, openGraph: { title, description, type: 'website' } };
}

export default function Page() {
  return <App />;
}
