'use client';
import { useEffect, useState } from 'react';
import { localToInstant } from '../lib/time';
import { checkinLoad, levelOf, leaveTarget, pickupTarget, queueEstimate } from '../lib/airportLogic';
import { useT } from './i18n';
export { checkinLoad, arrivalLoad, levelOf } from '../lib/airportLogic';

const HOUR = 3600e3, MIN = 60e3;

// שעה בשעון ישראל
export function clockIL(ms, tr) {
  return new Intl.DateTimeFormat(tr?.locale || 'he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(ms);
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
  const tr = useT();
  const now = useTick();
  const left = Math.max(0, Math.floor((target - now) / 1000));
  const parts = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60];
  return (
    <section className="card big" style={{ gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ fontSize: 18 }}>{title}</h2>
      {left > 0 ? (
        <div dir="ltr" role="timer" aria-label={`${label} ${clockIL(target, tr)}`} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {parts.map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ minWidth: 72, padding: '10px 6px', borderRadius: 16, background: 'var(--ink)', color: '#fff', fontSize: 38, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {String(v).padStart(2, '0')}
              </span>
              <span className="small muted">{[tr('שעות'), tr('דקות'), tr('שניות')][i]}</span>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--coral-ink)' }}>{doneText}</span>
      )}
      <span style={{ fontSize: 17 }}>{label} <b>{clockIL(target, tr)}</b></span>
      {extra}
    </section>
  );
}

// ---------- טיסה שממריאה מנתב״ג: מתי להיות בשדה ----------
export function LeaveHomeCard({ f, now }) {
  const tr = useT();
  const crowd = useCrowd();
  const dep = localToInstant(f.departure.estimated || f.departure.scheduled, f.departure.timezone || 'Asia/Jerusalem');
  if (!dep || dep < now || dep - now > 36 * HOUR) return null;
  const target = leaveTarget(f, dep, crowd);
  const domestic = f.arrival.iata === 'ETM' || f.arrival.iata === 'EIL';
  return <TimerCard title={tr('מתי להיות בשדה?')} label={tr('יש להיות בנתב״ג עד השעה')} target={target} doneText={tr('הגיע הזמן להיות בשדה!')}
    extra={<QueueMeter crowd={crowd} at={Math.max(now, target)} term={f.departure.terminal} domestic={domestic} atAirport={now >= target} />} />;
}

// ---------- מד המתנה משוער: בידוק ביטחוני + ביקורת דרכונים ----------
const SCALE = 90; // דקות: מלוא הפס
function QueueMeter({ crowd, at, term, domestic, atAirport }) {
  const tr = useT();
  const [info, setInfo] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = setTimeout(() => setShown(true), 60); return () => clearTimeout(id); }, []);
  const q = queueEstimate(crowd, at, { term, domestic });
  if (!q) return null;
  // הטווח מבודד משמאל לימין, כדי שבעברית יופיע 21–41 ולא 41–21
  const range = (r) => tr('{range} דק׳', { range: `\u2066${r[0]}–${r[1]}\u2069` });
  const mid = (r) => (r[0] + r[1]) / 2;
  const secW = Math.min(100, (mid(q.security) / SCALE) * 100);
  const pasW = q.passport ? Math.min(100 - secW, (mid(q.passport) / SCALE) * 100) : 0;
  const level = q.ratio >= 1 ? 'high' : q.ratio >= 0.55 ? 'mid' : 'low';
  return (
    <div className={`queue-meter ${level}`} role="group" aria-label={tr('עומס משוער בבידוק ובביקורת הדרכונים')}>
      <div className="queue-head">
        <span className="queue-title">
          <span className="live-dot" aria-hidden="true" />
          {q.passport ? tr('עומס משוער: בידוק + דרכונים') : tr('עומס משוער בבידוק')}
          <button type="button" className="info-btn" aria-expanded={info} aria-label={tr('על מה מבוססת ההערכה?')} onClick={() => setInfo((v) => !v)}>i</button>
        </span>
        <span className="queue-total">{tr('{range} סה״כ', { range: range(q.total) })}</span>
      </div>
      <div className="queue-bar" aria-hidden="true">
        <span className="seg sec" style={{ width: shown ? `${secW}%` : 0 }} />
        {q.passport && <span className="seg pas" style={{ width: shown ? `${pasW}%` : 0 }} />}
        <span className="shine" />
      </div>
      <div className="queue-legend">
        <span><i className="sw sec" aria-hidden="true" />{tr('בידוק ביטחוני: {range}', { range: range(q.security) })}</span>
        {q.passport && <span><i className="sw pas" aria-hidden="true" />{tr('ביקורת דרכונים: {range}', { range: range(q.passport) })}</span>}
      </div>
      <span className="queue-when">{atAirport ? tr('לפי העומס עכשיו') : tr('לפי העומס הצפוי ב-{time}, כשתגיעו', { time: clockIL(at, tr) })}{q.term ? ` · ${tr('טרמינל {n}', { n: q.term })}` : ''}</span>
      {info && (
        <p className="queue-info" role="note">
          {tr('הערכה של כנף, לא נתון רשמי: רשות שדות התעופה לא מפרסמת את זמני התורים בזמן אמת.')}{' '}
          {q.term
            ? tr('החישוב לפי מספר הטיסות שממריאות מטרמינל {n} כשעתיים עד ארבע שעות אחרי שתגיעו (כ-{count} טיסות בשעה), כי הנוסעים שלהן יעמדו איתכם בתור. המקור: לוח הטיסות של רשות שדות התעופה.', { n: q.term, count: q.flights })
            : tr('החישוב לפי מספר הטיסות שממריאות מנתב״ג כשעתיים עד ארבע שעות אחרי שתגיעו (כ-{count} טיסות בשעה), כי הנוסעים שלהן יעמדו איתכם בתור. המקור: לוח הטיסות של רשות שדות התעופה.', { count: q.flights })}{' '}
          {tr('את המספר המרנו לדקות לפי זמני ההמתנה שרשות שדות התעופה פרסמה: פחות מרבע שעה בשעות רגועות, וכ-35 דקות לבידוק ולרישום בשעות העמוסות. מספר הבודקים בפועל, חגים ומזוודות יכולים לשנות את הזמן.')}
        </p>
      )}
    </div>
  );
}

// ניווט ב-Waze ל"טרמינל 3 שער 32": היציאה של הנוחתים. נקודה על דרך הנוחתים, כדי ש-Waze לא ינווט לדרך הממריאים שמעליה
const WAZE_T3_ARRIVALS = 'https://waze.com/ul/hsv8y192n0';

// ---------- טיסה שנוחתת בנתב״ג: מתי להיות בשדה כדי לאסוף ----------
export function PickupCard({ f, now }) {
  const tr = useT();
  const crowd = useCrowd();
  const land = localToInstant(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone || 'Asia/Jerusalem');
  if (!land) return null;
  const target = pickupTarget(land, crowd);
  if (now > target + 30 * MIN || target - now > 36 * HOUR) return null;
  // ניווט ב-Waze ישר לאזור הנחיתות של טרמינל 3 (רק כשהטיסה נוחתת בטרמינל 3 או שהטרמינל לא ידוע)
  const t3 = !f.arrival.terminal || String(f.arrival.terminal) === '3';
  const waze = t3 ? (
    <a href={WAZE_T3_ARRIVALS} target="_blank" rel="noopener noreferrer" className="waze-btn" aria-label={tr('ניווט ב-Waze לנמל התעופה בן גוריון, טרמינל 3 נחיתות, שער 32')}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 2.5c-5 0-9 3.6-9 8.3 0 2 .7 3.6 1.7 4.8-.3 1.1-1 2-2 2.6 1.6.4 3.3 0 4.6-1 1.4.7 3 1.1 4.7 1.1 5 0 9-3.6 9-8.3s-4-7.5-9-7.5z" /><circle cx="9" cy="10" r="1.2" fill="#0E2A47" /><circle cx="15" cy="10" r="1.2" fill="#0E2A47" /><path d="M8.8 13.2c1.6 1.6 4.8 1.6 6.4 0" stroke="#0E2A47" strokeWidth="1.4" fill="none" strokeLinecap="round" /><circle cx="8" cy="19.5" r="1.8" fill="#0E2A47" /><circle cx="16" cy="19.5" r="1.8" fill="#0E2A47" /></svg>
      <span>{tr('ניווט לטרמינל 3, נחיתות (שער 32)')}</span>
    </a>
  ) : null;
  return <TimerCard title={tr('באים לאסוף?')} label={tr('יש להיות בנתב״ג בשעה')} target={target} doneText={tr('הנוסע יוצא עכשיו')} extra={waze} />;
}

// ---------- עומס בצ׳ק-אין ל-12 השעות הקרובות (בלשונית "לוח") ----------
export function CrowdForecast({ now }) {
  const tr = useT();
  const crowd = useCrowd();
  if (!crowd) return null;
  const base = Math.floor(now / HOUR) * HOUR;
  const cols = Array.from({ length: 12 }, (_, i) => {
    const t = base + i * HOUR;
    const n = checkinLoad(crowd, t + HOUR / 2);
    return { t, n, lv: levelOf(n, tr) };
  }).filter((c) => c.n != null);
  if (cols.length < 3) return null;
  const max = Math.max(12, ...cols.map((c) => c.n));
  const busiest = cols.reduce((a, b) => (b.n > a.n ? b : a));
  return (
    <section className="card" style={{ gap: 8 }}>
      <div className="row">
        <h2>{tr('עומס צפוי בצ׳ק-אין')}</h2>
        <span className="badge" style={{ background: cols[0].lv.bg, color: cols[0].lv.color }}>{tr('עכשיו: {level}', { level: cols[0].lv.text })}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 4, alignItems: 'end', height: 64 }} aria-hidden="true">
        {cols.map((c, i) => <div key={c.t} style={{ height: `${Math.max(10, (c.n / max) * 100)}%`, borderRadius: 6, background: c.lv.color, opacity: i === 0 ? 1 : 0.6 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 4, textAlign: 'center' }}>
        {cols.map((c, i) => <span key={c.t} style={{ fontSize: 10, color: 'var(--muted)' }}>{i % 2 === 0 ? clockIL(c.t, tr).slice(0, 2) : ''}</span>)}
      </div>
      <span className="small muted">{busiest.lv.key === 'high' ? `${tr('השעה העמוסה ביותר: סביב {time}.', { time: clockIL(busiest.t, tr) })} ` : ''}{tr('מחושב לפי מספר הטיסות שממריאות כשלוש שעות אחר כך.')}</span>
    </section>
  );
}
