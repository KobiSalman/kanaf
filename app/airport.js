'use client';
import { useEffect, useState } from 'react';
import { localToInstant } from '../lib/time';

const HOUR = 3600e3, MIN = 60e3;

// שעה בשעון ישראל
export function clockIL(ms) {
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(ms);
}

// עיגול לרבע שעה כלפי מטה: "לצאת ב-14:45" ולא "14:52"
const floor15 = (ms) => Math.floor(ms / (15 * MIN)) * 15 * MIN;
const ceil5 = (ms) => Math.ceil(ms / (5 * MIN)) * 5 * MIN;

// לוח העומס של נתב״ג: כמה המראות ונחיתות בכל שעה. נטען פעם אחת ומתעדכן כל 10 דקות
let crowdCache = null;
export function useCrowd() {
  const [crowd, setCrowd] = useState(crowdCache?.data || null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (crowdCache && Date.now() - crowdCache.at < 10 * MIN) { setCrowd(crowdCache.data); return; }
      try {
        const res = await fetch('/api/crowd');
        if (!res.ok) return;
        const data = await res.json();
        crowdCache = { at: Date.now(), data };
        if (!stop) setCrowd(data);
      } catch {}
    };
    load();
    const id = setInterval(load, 10 * MIN);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return crowd;
}

const bucket = (crowd, t) => crowd?.hours?.find((h) => t >= h.t && t < h.t + HOUR);

// עומס בצ׳ק-אין בשעה מסוימת: לפי הטיסות שממריאות כשלוש שעות אחר כך (2 עד 4 שעות, עם משקל)
export function checkinLoad(crowd, t) {
  if (!crowd) return null;
  const d = (h) => bucket(crowd, t + h * HOUR)?.dep ?? null;
  const [a, b, c] = [d(2), d(3), d(4)];
  if (b == null) return null;
  return ((a ?? b) * 0.5 + b + (c ?? b) * 0.5) / 2;
}

// כמה מטוסים נוחתים בסביבת שעת הנחיתה (שעה לפני ושעה אחרי, עם משקל)
export function arrivalLoad(crowd, t) {
  if (!crowd) return null;
  const n = (h) => bucket(crowd, t + h * HOUR)?.arr ?? null;
  const [a, b, c] = [n(-1), n(0), n(1)];
  if (b == null) return null;
  return ((a ?? b) * 0.5 + b + (c ?? b) * 0.5) / 2;
}

export function levelOf(n) {
  if (n == null) return null;
  if (n >= 12) return { key: 'high', text: 'עמוס', color: '#B4471F', bg: '#FFD9D2' };
  if (n >= 7) return { key: 'mid', text: 'בינוני', color: '#7A5A00', bg: '#FFF3C4' };
  return { key: 'low', text: 'רגוע', color: '#0B5A33', bg: '#C8F5DC' };
}

// טיימר שמתקתק כל שנייה עד שעת היעד
function useTick() {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function TimerCard({ title, label, target, doneText }) {
  const now = useTick();
  const left = Math.max(0, Math.floor((target - now) / 1000));
  const parts = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60];
  return (
    <section className="card big" style={{ gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ fontSize: 18 }}>{title}</h2>
      {left > 0 ? (
        <div dir="ltr" role="timer" aria-label={`${label} ${clockIL(target)}`} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {parts.map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ minWidth: 72, padding: '10px 6px', borderRadius: 16, background: 'var(--ink)', color: '#fff', fontSize: 38, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {String(v).padStart(2, '0')}
              </span>
              <span className="small muted">{['שעות', 'דקות', 'שניות'][i]}</span>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--coral-ink)' }}>{doneText}</span>
      )}
      <span style={{ fontSize: 17 }}>{label} <b>{clockIL(target)}</b></span>
    </section>
  );
}

// ---------- טיסה שממריאה מנתב״ג: מתי להיות בשדה ----------
export function LeaveHomeCard({ f, now }) {
  const crowd = useCrowd();
  const dep = localToInstant(f.departure.estimated || f.departure.scheduled, f.departure.timezone || 'Asia/Jerusalem');
  if (!dep || dep < now || dep - now > 36 * HOUR) return null;
  // 3 שעות לפני (לאילת שעתיים), ועוד חצי שעה כשצפוי עומס בצ׳ק-אין
  const domestic = f.arrival.iata === 'ETM' || f.arrival.iata === 'EIL';
  const raw = dep - (domestic ? 2 : 3) * HOUR;
  const extra = !domestic && levelOf(checkinLoad(crowd, raw))?.key === 'high' ? 30 : 0;
  const target = floor15(raw - extra * MIN);
  return <TimerCard title="עד שצריך להיות בשדה" label="להיות בנתב״ג עד השעה" target={target} doneText="הגיע הזמן להיות בשדה!" />;
}

// ---------- טיסה שנוחתת בנתב״ג: מתי להיות בשדה כדי לאסוף ----------
export function PickupCard({ f, now }) {
  const crowd = useCrowd();
  const land = localToInstant(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone || 'Asia/Jerusalem');
  if (!land) return null;
  // יציאה מהטרמינל: ירידה מהמטוס, ביקורת גבולות ומזוודות. כ-30 דקות, יותר כשהרבה מטוסים נוחתים יחד
  const lv = levelOf(arrivalLoad(crowd, land));
  const add = lv?.key === 'high' ? 20 : lv?.key === 'mid' ? 10 : 0;
  const target = ceil5(land + (30 + add) * MIN);
  if (now > target + 30 * MIN || target - now > 36 * HOUR) return null;
  return <TimerCard title="באים לאסוף?" label="להיות בנתב״ג בשעה" target={target} doneText="הנוסע יוצא עכשיו" />;
}

// ---------- עומס בצ׳ק-אין ל-12 השעות הקרובות (בלשונית "לוח") ----------
export function CrowdForecast({ now }) {
  const crowd = useCrowd();
  if (!crowd) return null;
  const base = Math.floor(now / HOUR) * HOUR;
  const cols = Array.from({ length: 12 }, (_, i) => {
    const t = base + i * HOUR;
    const n = checkinLoad(crowd, t + HOUR / 2);
    return { t, n, lv: levelOf(n) };
  }).filter((c) => c.n != null);
  if (cols.length < 3) return null;
  const max = Math.max(12, ...cols.map((c) => c.n));
  const busiest = cols.reduce((a, b) => (b.n > a.n ? b : a));
  return (
    <section className="card" style={{ gap: 8 }}>
      <div className="row">
        <h2>עומס צפוי בצ׳ק-אין</h2>
        <span className="badge" style={{ background: cols[0].lv.bg, color: cols[0].lv.color }}>עכשיו: {cols[0].lv.text}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 4, alignItems: 'end', height: 64 }} aria-hidden="true">
        {cols.map((c, i) => <div key={c.t} style={{ height: `${Math.max(10, (c.n / max) * 100)}%`, borderRadius: 6, background: c.lv.color, opacity: i === 0 ? 1 : 0.6 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 4, textAlign: 'center' }}>
        {cols.map((c, i) => <span key={c.t} style={{ fontSize: 10, color: 'var(--muted)' }}>{i % 2 === 0 ? clockIL(c.t).slice(0, 2) : ''}</span>)}
      </div>
      <span className="small muted">{busiest.lv.key === 'high' ? `השעה העמוסה ביותר: סביב ${clockIL(busiest.t)}. ` : ''}מחושב לפי מספר הטיסות שממריאות כשלוש שעות אחר כך.</span>
    </section>
  );
}
