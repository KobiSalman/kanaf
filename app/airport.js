'use client';
import { useEffect, useState } from 'react';
import { localToInstant } from '../lib/time';
import { checkinLoad, levelOf, leaveTarget, pickupTarget } from '../lib/airportLogic';
export { checkinLoad, arrivalLoad, levelOf } from '../lib/airportLogic';

const HOUR = 3600e3, MIN = 60e3;

// שעה בשעון ישראל
export function clockIL(ms) {
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(ms);
}

// עיגול לרבע שעה כלפי מטה: "לצאת ב-14:45" ולא "14:52"

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

// טיימר שמתקתק כל שנייה עד שעת היעד
function useTick() {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function TimerCard({ title, label, target, doneText, extra }) {
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
      {extra}
    </section>
  );
}

// ---------- טיסה שממריאה מנתב״ג: מתי להיות בשדה ----------
export function LeaveHomeCard({ f, now }) {
  const crowd = useCrowd();
  const dep = localToInstant(f.departure.estimated || f.departure.scheduled, f.departure.timezone || 'Asia/Jerusalem');
  if (!dep || dep < now || dep - now > 36 * HOUR) return null;
  const target = leaveTarget(f, dep, crowd);
  return <TimerCard title="מתי להיות בשדה?" label="יש להיות בנתב״ג עד השעה" target={target} doneText="הגיע הזמן להיות בשדה!" />;
}

// ניווט ב-Waze ל"טרמינל 3 שער 32": היציאה של הנוחתים. נקודה על דרך הנוחתים, כדי ש-Waze לא ינווט לדרך הממריאים שמעליה
const WAZE_T3_ARRIVALS = 'https://waze.com/ul/hsv8y192n0';

// ---------- טיסה שנוחתת בנתב״ג: מתי להיות בשדה כדי לאסוף ----------
export function PickupCard({ f, now }) {
  const crowd = useCrowd();
  const land = localToInstant(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone || 'Asia/Jerusalem');
  if (!land) return null;
  const target = pickupTarget(land, crowd);
  if (now > target + 30 * MIN || target - now > 36 * HOUR) return null;
  // ניווט ב-Waze ישר לאזור הנחיתות של טרמינל 3 (רק כשהטיסה נוחתת בטרמינל 3 או שהטרמינל לא ידוע)
  const t3 = !f.arrival.terminal || String(f.arrival.terminal) === '3';
  const waze = t3 ? (
    <a href={WAZE_T3_ARRIVALS} target="_blank" rel="noopener noreferrer" className="waze-btn" aria-label="ניווט ב-Waze לנמל התעופה בן גוריון, טרמינל 3 נחיתות, שער 32">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 2.5c-5 0-9 3.6-9 8.3 0 2 .7 3.6 1.7 4.8-.3 1.1-1 2-2 2.6 1.6.4 3.3 0 4.6-1 1.4.7 3 1.1 4.7 1.1 5 0 9-3.6 9-8.3s-4-7.5-9-7.5z" /><circle cx="9" cy="10" r="1.2" fill="#0E2A47" /><circle cx="15" cy="10" r="1.2" fill="#0E2A47" /><path d="M8.8 13.2c1.6 1.6 4.8 1.6 6.4 0" stroke="#0E2A47" strokeWidth="1.4" fill="none" strokeLinecap="round" /><circle cx="8" cy="19.5" r="1.8" fill="#0E2A47" /><circle cx="16" cy="19.5" r="1.8" fill="#0E2A47" /></svg>
      <span>ניווט לטרמינל 3, נחיתות (שער 32)</span>
    </a>
  ) : null;
  return <TimerCard title="באים לאסוף?" label="יש להיות בנתב״ג בשעה" target={target} doneText="הנוסע יוצא עכשיו" extra={waze} />;
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
