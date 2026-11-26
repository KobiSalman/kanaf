'use client';
import { useEffect, useState } from 'react';
import { localToInstant, minutesLabel } from '../lib/time';

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

// זמן הנסיעה לשדה: נשמר בטלפון, כדי שלא צריך לבחור בכל פעם
const DRIVES = [15, 30, 45, 60, 90];
export function useDrive() {
  const [drive, setDrive] = useState(45);
  useEffect(() => { try { const v = Number(localStorage.getItem('kanaf:drive')); if (DRIVES.includes(v)) setDrive(v); } catch {} }, []);
  const save = (v) => { setDrive(v); try { localStorage.setItem('kanaf:drive', String(v)); } catch {} };
  return [drive, save];
}

function DrivePicker({ drive, setDrive, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="small muted">{label}</span>
      <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${DRIVES.length}, minmax(0, 1fr))`, gap: 6 }}>
        {DRIVES.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={drive === v} onClick={() => setDrive(v)}
            style={{ height: 38, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              background: drive === v ? 'var(--ink)' : '#EEF4FA', color: drive === v ? '#fff' : 'var(--ink)' }}>
            {v < 60 ? `${v} דק׳` : v === 60 ? 'שעה' : 'שעה וחצי'}
          </button>
        ))}
      </div>
    </div>
  );
}

// פס עומס קטן: כמה שעות סביב השעה שלך, עם סימון השעה שלך
function LoadStrip({ crowd, center, loadAt, caption }) {
  if (!crowd) return null;
  const base = Math.floor(center / HOUR) * HOUR;
  const cols = [-2, -1, 0, 1, 2].map((h) => {
    const t = base + h * HOUR;
    const n = loadAt(crowd, t + HOUR / 2);
    return { t, n, lv: levelOf(n), mine: h === 0 };
  }).filter((c) => c.n != null);
  if (!cols.length) return null;
  const max = Math.max(12, ...cols.map((c) => c.n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="small muted">{caption}</span>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 70 }} aria-hidden="true">
        {cols.map((c) => (
          <div key={c.t} style={{ height: `${Math.max(12, (c.n / max) * 100)}%`, borderRadius: 8, background: c.lv.color, opacity: c.mine ? 1 : 0.35 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 6, textAlign: 'center' }}>
        {cols.map((c) => <span key={c.t} className="small" style={{ fontWeight: c.mine ? 800 : 400, color: c.mine ? 'var(--ink)' : 'var(--muted)' }}>{clockIL(c.t)}</span>)}
      </div>
    </div>
  );
}

function Countdown({ at, now }) {
  const m = Math.max(1, Math.round((at - now) / MIN));
  return <span className="strong" style={{ color: 'var(--good)' }}>עוד {minutesLabel(m)}</span>;
}

// ---------- "מתי לצאת מהבית" לטיסה שממריאה מנתב״ג ----------
export function LeaveHomeCard({ f, now }) {
  const crowd = useCrowd();
  const [drive, setDrive] = useDrive();
  const dep = localToInstant(f.departure.estimated || f.departure.scheduled, f.departure.timezone || 'Asia/Jerusalem');
  if (!dep || dep < now) return null;
  if (dep - now > 36 * HOUR) {
    return (
      <section className="card" style={{ gap: 6 }}>
        <h2>מתי לצאת מהבית</h2>
        <span style={{ fontSize: 14, lineHeight: 1.55 }}>יום לפני הטיסה נראה לך כאן מתי כדאי לצאת, לפי העומס הצפוי בצ׳ק-אין ולפי זמן הנסיעה שלך.</span>
      </section>
    );
  }
  const domestic = f.arrival.iata === 'ETM' || f.arrival.iata === 'EIL';
  const baseH = domestic ? 2 : 3;
  const arriveRaw = dep - baseH * HOUR;
  const load = checkinLoad(crowd, arriveRaw);
  const lv = levelOf(load);
  const extra = !domestic && lv?.key === 'high' ? 30 : 0;
  const arriveAt = floor15(arriveRaw - extra * MIN);
  const leaveAt = floor15(arriveAt - drive * MIN);
  const reason = domestic ? 'לטיסה פנים-ארצית מספיק להגיע שעתיים לפני' : extra ? 'ההנחיה היא 3 שעות לפני, ובגלל העומס הוספנו חצי שעה' : 'ההנחיה הרשמית היא להגיע 3 שעות לפני ההמראה';

  return (
    <section className="card big" style={{ gap: 12 }}>
      <div className="row">
        <h2 style={{ fontSize: 18 }}>מתי לצאת מהבית</h2>
        {lv && <span className="badge" style={{ background: lv.bg, color: lv.color }}>צ׳ק-אין {lv.text}</span>}
      </div>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="tile"><span className="label">לצאת מהבית</span><span className="value" style={{ fontSize: 26 }}>{clockIL(leaveAt)}</span></div>
        <div className="tile"><span className="label">להגיע לשדה</span><span className="value" style={{ fontSize: 26 }}>{clockIL(arriveAt)}</span></div>
      </div>
      <div className="row"><span className="muted">{reason}</span></div>
      {now < leaveAt
        ? <div className="row"><span className="muted">עד שצריך לצאת</span><Countdown at={leaveAt} now={now} /></div>
        : <div className="row"><span className="strong" style={{ color: 'var(--coral-ink)' }}>צאו עכשיו</span><span className="strong" style={{ color: 'var(--coral-ink)' }}>תגיעו כ-{minutesLabel(Math.max(0, Math.round((dep - now - drive * MIN) / MIN)))} לפני ההמראה</span></div>}
      <DrivePicker drive={drive} setDrive={setDrive} label="כמה זמן הנסיעה שלך לנתב״ג?" />
      {!domestic && <LoadStrip crowd={crowd} center={arriveAt} loadAt={checkinLoad} caption="עומס צפוי באולם הצ׳ק-אין, לפי כמות הטיסות שממריאות" />}
      <span className="small muted" style={{ lineHeight: 1.55 }}>
        טיפ: צ׳ק-אין מהבית ומזוודות במשקל הנכון מקצרים מאוד את התור. בימים עמוסים החניונים מתמלאים, ורכבת או מונית יכולות לחסוך זמן.
        העומס מחושב מלוח הטיסות של נתב״ג וזו הערכה. אם חברת התעופה ביקשה להגיע מוקדם יותר, ההנחיה שלה קובעת.
      </span>
    </section>
  );
}

// ---------- "באים לאסוף?" לטיסה שנוחתת בנתב״ג ----------
export function PickupCard({ f, now }) {
  const crowd = useCrowd();
  const [drive, setDrive] = useDrive();
  const [hand, setHand] = useState(false);
  const landed = !!f.arrival.actual;
  const land = localToInstant(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone || 'Asia/Jerusalem');
  if (!land) return null;
  if (now - land > 2 * HOUR) return null;

  // יציאה מהטרמינל: ירידה מהמטוס, ביקורת גבולות ומזוודות. בממוצע 30 עד 50 דקות, יותר כשהרבה מטוסים נוחתים יחד
  const load = arrivalLoad(crowd, land);
  const lv = levelOf(load);
  const add = lv?.key === 'high' ? 20 : lv?.key === 'mid' ? 10 : 0;
  const [lo, hi] = hand ? [20 + add / 2, 35 + add] : [30 + add, 50 + add];
  const outFrom = ceil5(land + lo * MIN), outTo = ceil5(land + hi * MIN);
  const leaveAt = floor15(outFrom - drive * MIN);
  const sinceLand = Math.round((now - land) / MIN);

  return (
    <section className="card big" style={{ gap: 12 }}>
      <div className="row">
        <h2 style={{ fontSize: 18 }}>באים לאסוף?</h2>
        {lv && <span className="badge" style={{ background: lv.bg, color: lv.color }}>נחיתות {lv.text}</span>}
      </div>
      {landed && <span className="strong" style={{ color: 'var(--good)' }}>המטוס נחת {sinceLand > 0 ? `לפני ${minutesLabel(sinceLand)}` : 'עכשיו'}</span>}
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="tile"><span className="label">לצאת מהבית</span><span className="value" style={{ fontSize: 26 }}>{clockIL(leaveAt)}</span></div>
        <div className="tile"><span className="label">יוצאים מהטרמינל</span><span className="value" style={{ fontSize: 20 }}><bdi dir="ltr">{clockIL(outFrom)}–{clockIL(outTo)}</bdi></span></div>
      </div>
      {now < leaveAt
        ? <div className="row"><span className="muted">עד שצריך לצאת</span><Countdown at={leaveAt} now={now} /></div>
        : <div className="row"><span className="strong" style={{ color: 'var(--coral-ink)' }}>צאו עכשיו</span><span className="strong" style={{ color: 'var(--coral-ink)', textAlign: 'left' }}>{(() => { const w = Math.round((now + drive * MIN - outFrom) / MIN); return w > 5 ? `הנוסע יחכה לכם כ-${minutesLabel(w)}` : 'תגיעו בדיוק בזמן'; })()}</span></div>}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={hand} onChange={(e) => setHand(e.target.checked)} style={{ width: 18, height: 18 }} />
        טסים רק עם טרולי, בלי מזוודה בבטן המטוס
      </label>
      <DrivePicker drive={drive} setDrive={setDrive} label="כמה זמן הנסיעה שלך לנתב״ג?" />
      <LoadStrip crowd={crowd} center={land} loadAt={arrivalLoad} caption="כמה מטוסים נוחתים סביב אותה שעה (יותר נחיתות = תורים ארוכים יותר)" />
      <div className="card cream" style={{ padding: 12, gap: 4 }}>
        <span className="strong">אל תחכו ברכב מול הטרמינל</span>
        <span style={{ fontSize: 14, color: '#5C4A12', lineHeight: 1.55 }}>
          מול טרמינל 3 מותר לעצור רק כדי להעלות נוסע מיד, ומצלמות אכיפה נותנות קנס של 500 ש״ח גם על נסיעה איטית שם.
          עדיף לחכות בחניון ההמתנה, כמה דקות מהטרמינל: השעה הראשונה בחינם. בקשו מהנוסע להתקשר כשהוא יוצא עם המזוודות, ורק אז סעו לאסוף.
        </span>
      </div>
      <span className="small muted">זו הערכה לפי שעת הנחיתה ולפי כמות הנחיתות בלוח של נתב״ג. עיכובים במזוודות או בביקורת הגבולות יכולים להאריך את היציאה.</span>
    </section>
  );
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
