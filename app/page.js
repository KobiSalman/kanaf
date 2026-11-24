'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hhmm, localToInstant, todayIn, minutesLabel, agoLabel } from '../lib/time';
import { AIRCRAFT } from '../lib/aviation';
import { AIRLINE_STATUS, assessFlight, heDate } from '../lib/airlineStatus';
import { TYPE_INFO, seatBlocks, seatSide } from '../lib/aircraftInfo';
import AirlineLogo, { iataFromCallsign } from './AirlineLogo';
import { Sky, skyTheme, ArcPlane, BoardingPass } from './visuals';

const STATUS = {
  scheduled: { text: 'מתוכננת', tone: 'good' },
  active: { text: 'בטיסה', tone: 'good' },
  landed: { text: 'נחתה', tone: 'good' },
  cancelled: { text: 'בוטלה', tone: 'bad' },
  incident: { text: 'אירוע', tone: 'bad' },
  diverted: { text: 'הוסטה', tone: 'warn' }
};


const CITY = {
  TLV: 'תל אביב', ETM: 'אילת', LHR: 'לונדון', LTN: 'לונדון', STN: 'לונדון', LGW: 'לונדון', CDG: 'פריז', ORY: 'פריז',
  JFK: 'ניו יורק', EWR: 'ניו יורק', FCO: 'רומא', MXP: 'מילאנו', ATH: 'אתונה', BCN: 'ברצלונה', MAD: 'מדריד',
  BER: 'ברלין', MUC: 'מינכן', FRA: 'פרנקפורט', AMS: 'אמסטרדם', VIE: 'וינה', PRG: 'פראג', BUD: 'בודפשט',
  ZRH: 'ציריך', IST: 'איסטנבול', LCA: 'לרנקה', DXB: 'דובאי', AUH: 'אבו דאבי', BKK: 'בנגקוק', LAX: 'לוס אנג׳לס',
  MIA: 'מיאמי', SFO: 'סן פרנסיסקו', BOS: 'בוסטון', YYZ: 'טורונטו', LIS: 'ליסבון', WAW: 'ורשה', BUH: 'בוקרשט',
  OTP: 'בוקרשט', SOF: 'סופיה', TBS: 'טביליסי', LED: 'סנט פטרבורג', HND: 'טוקיו', NRT: 'טוקיו', DEL: 'דלהי', BOM: 'מומבאי'
};
const cityOf = (side) => CITY[side.iata] || side.cityHe || side.iata;

const PlaneIcon = ({ color = 'currentColor', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);
const GaugeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4-5" /><circle cx="12" cy="17" r="1.2" />
  </svg>
);
const TopIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" />
  </svg>
);

function Clouds() {
  return (
    <>
      <div className="sun" aria-hidden="true" />
      <div className="cloud" style={{ left: 40, top: 118, width: 120, height: 36, opacity: 0.9 }} aria-hidden="true" />
      <div className="cloud" style={{ left: 80, top: 100, width: 60, height: 44, opacity: 0.9 }} aria-hidden="true" />
      <div className="cloud" style={{ right: -30, top: 190, width: 140, height: 34, opacity: 0.6 }} aria-hidden="true" />
    </>
  );
}

function times(f) {
  const dep = f.departure, arr = f.arrival;
  const depAt = localToInstant(dep.actual || dep.estimated || dep.scheduled, dep.timezone);
  const arrAt = localToInstant(arr.actual || arr.estimated || arr.scheduled, arr.timezone);
  const arrSched = localToInstant(arr.scheduled, arr.timezone);
  return { depAt, arrAt, arrSched };
}

const airIata = (f) => (f ? f.airlineIata || (f.liveOnly ? iataFromCallsign(f.callsign) : f.flight.slice(0, 2)) : null);

function flightState(f) {
  // טיסה נכנסת מלוח נתב״ג: אין שעת המראה בפועל מחו״ל, אז אם עברה ההמראה המשוערת והטיסה עוד לא נחתה, היא כנראה באוויר
  let guessedAirborne = false;
  if (f.source === 'iaa' && f.status === 'scheduled' && f.departure.estimated) {
    // הלוח של נתב״ג מתעדכן באיחור: אם עברו 20 דקות מההמראה הצפויה ואין ביטול, הטיסה כנראה באוויר
    const depAt = localToInstant(f.departure.estimated, f.departure.timezone);
    guessedAirborne = !!depAt && Date.now() > depAt + (f.direction === 'arrival' ? 15 : 20) * 60000;
  }
  const departed = !!f.departure.actual || !!(f.live && !f.live.isGround) || !!f.wasAirborne || guessedAirborne;
  const landed = f.status === 'landed' || !!f.arrival.actual || !!(f.wasAirborne && f.live && f.live.isGround);
  return { departed, landed };
}

function statusOf(f) {
  const { departed, landed } = flightState(f);
  if (f.status === 'cancelled' || f.status === 'diverted' || f.status === 'incident') return STATUS[f.status];
  if (landed) return STATUS.landed;
  if (!departed) return { text: 'לפני המראה', tone: 'warn' };
  return STATUS.active;
}

function SearchCard({ flightNo, setFlightNo, date, setDate, onSearch, onCancel, loading }) {
  return (
    <form className="card edit" onSubmit={(e) => { e.preventDefault(); onSearch(); }}>
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>איזו טיסה לעקוב?</h2>
      <div className="field">
        <label htmlFor="flightNo">מספר טיסה</label>
        <input id="flightNo" value={flightNo} onChange={(e) => setFlightNo(e.target.value.toUpperCase())} placeholder="לדוגמה LY315" autoCapitalize="characters" />
      </div>
      <div className="field">
        <label htmlFor="flightDate">תאריך</label>
        <input id="flightDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-sun" disabled={loading || !flightNo}>{loading ? 'מחפש…' : 'חפש טיסה'}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>ביטול</button>}
      </div>
    </form>
  );
}

function InboundCard({ f, inbound, now }) {
  if (!inbound || inbound.error) return null;
  const reg = f.aircraft?.registration;
  const from = f.departure.iata;
  const s = inbound.state;
  let title = '', text = '', tone = null, extra = null;

  if (s === 'silent') {
    title = 'המטוס לא משדר כרגע';
    text = `${reg} לא משדר מיקום. בדרך כלל זה אומר שהוא חונה ומנועיו כבויים, למשל כבר בשדה שממנו תמריא.`;
  } else if (s === 'at_airport') {
    title = 'המטוס כבר בשדה ✓';
    text = `${reg} נמצא ב-${from}. זה סימן טוב להמראה בזמן.`;
    tone = 'good';
  } else if (s === 'ground_elsewhere') {
    title = 'המטוס על הקרקע בשדה אחר';
    text = `${reg} נמצא כ-${inbound.distKm} ק״מ מ-${from}. הוא יצטרך לטוס לכאן לפני הטיסה שלך.`;
    tone = 'warn';
  } else if (s === 'inbound') {
    title = 'המטוס בדרך אליך';
    text = `${reg} טס עכשיו${inbound.nowCallsign ? ` כ-${inbound.nowCallsign}` : ''}, כ-${inbound.distKm} ק״מ מ-${from}, וצפוי לנחות בעוד כ-${minutesLabel(inbound.etaMin)}.`;
    const depAt = localToInstant(f.departure.estimated || f.departure.scheduled, f.departure.timezone);
    const readyAt = Date.parse(inbound.checkedAt) + (inbound.etaMin + 45) * 60000;
    const late = depAt ? Math.round((readyAt - depAt) / 60000) : null;
    if (late != null && late > 5) { tone = 'bad'; extra = `ההמראה שלך עלולה להתעכב בכ-${minutesLabel(late)}`; }
    else if (late != null) { tone = 'good'; extra = 'יש מספיק זמן להכנה בין הטיסות'; }
  } else if (s === 'flying_elsewhere') {
    title = 'המטוס טס עכשיו לכיוון אחר';
    text = `${reg} באוויר${inbound.nowCallsign ? ` כ-${inbound.nowCallsign}` : ''}, כ-${inbound.distKm} ק״מ מ-${from}, ולא בכיוון אליו. ייתכן שזו טיסה קודמת שעוד תחזור, או שחברת התעופה תחליף מטוס.`;
    tone = 'warn';
  } else if (s === 'is_our_flight') {
    return null;
  } else {
    title = inbound.onGround ? 'המטוס על הקרקע' : 'המטוס באוויר';
    text = `לא הצלחנו לזהות את מיקום שדה ${from}, ולכן אין הערכה.`;
  }

  return (
    <section className="card">
      <div className="row">
        <h2>המטוס הגיע?</h2>
        {tone && <span className={`badge ${tone}`}>{tone === 'good' ? 'בסדר' : tone === 'bad' ? 'עיכוב אפשרי' : 'לשים לב'}</span>}
      </div>
      <span className="strong" style={{ fontSize: 17 }}>{title}</span>
      <span style={{ fontSize: 14, lineHeight: 1.55 }}>{text}</span>
      {extra && <span className="strong" style={{ fontSize: 14, color: tone === 'bad' ? '#8A2412' : 'var(--good)' }}>{extra}</span>}
      <span className="small muted">הערכה בלבד, לפי מיקום המטוס בזמן אמת (adsb.lol) וזמן הכנה של כ-45 דק׳ בין טיסות · {agoLabel(now - Date.parse(inbound.checkedAt))}</span>
    </section>
  );
}

const TLV_COORDS = { lat: 32.0114, lon: 34.8867, label: 'נתב״ג' };

function NearbyTab({ now }) {
  const [where, setWhere] = useState(null);
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setStatus('denied'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setWhere({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'המיקום שלך' }); setStatus('ready'); },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  useEffect(() => {
    if (!where) return;
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/nearby?lat=${where.lat}&lon=${where.lon}`);
        const body = await res.json();
        if (stop) return;
        if (!res.ok) setError(body.error || 'משהו השתבש');
        else { setData(body); setError(''); }
      } catch { if (!stop) setError('אין חיבור לאינטרנט'); }
    };
    load();
    const id = setInterval(load, 20000);
    return () => { stop = true; clearInterval(id); };
  }, [where]);

  const planes = data?.planes || [];
  const flying = planes.filter((p) => !p.onGround);
  const ground = planes.filter((p) => p.onGround);

  return (
    <>
      <header className="hero short" style={{ background: skyTheme('Asia/Jerusalem', Date.now()).bg, color: skyTheme('Asia/Jerusalem', Date.now()).ink }}>
        <Sky theme={skyTheme('Asia/Jerusalem', Date.now())} />
        <span className="pill">{where ? where.label : 'מאתר מיקום…'} ✦</span>
        <h1>מה טס מעליי?</h1>
        <p>{data ? `${flying.length} מטוסים באוויר ברדיוס ${data.radiusKm} ק״מ` : 'כל המטוסים סביבך, בזמן אמת'}</p>
      </header>
      <div className="content flat">
        {status === 'denied' && !where && (
          <section className="card cream">
            <span className="strong">אין גישה למיקום</span>
            <span style={{ fontSize: 14 }}>אפשר לאשר גישה למיקום בדפדפן, או לראות מה טס עכשיו ליד נתב״ג.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-sun" onClick={() => { setWhere(TLV_COORDS); setStatus('ready'); }}>הצג ליד נתב״ג</button>
              <button type="button" className="btn-ghost" onClick={locate}>נסה שוב</button>
            </div>
          </section>
        )}
        {status === 'locating' && <div className="card">מאתר את המיקום שלך…</div>}
        {error && <div className="error" role="alert">{error}</div>}
        {data && planes.length === 0 && <div className="card">אין כרגע מטוסים משדרים באזור.</div>}

        {flying.map((p) => (
          <section key={p.id} className="card" style={{ gap: 6 }}>
            <div className="row">
              <span style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>{iataFromCallsign(p.callsign) && <AirlineLogo iata={iataFromCallsign(p.callsign)} name={p.airline} size={26} />}{p.callsign || p.registration || 'ללא זיהוי'}{p.airline ? <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> · {p.airline}</span> : null}</span>
              <span className="badge good">{p.distKm} ק״מ{p.fromYou ? ` · ${p.fromYou}` : ''}</span>
            </div>
            <span style={{ fontSize: 14 }}>{p.type ? (AIRCRAFT[p.type] || p.type) : 'דגם לא ידוע'}{p.registration && p.callsign ? ` · ${p.registration}` : ''}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {p.altFt.toLocaleString('en-US')} רגל · {p.speedKmh} קמ״ש
              {p.verticalFpm > 300 ? ' · מטפס' : p.verticalFpm < -300 ? ' · יורד' : ''}
              {p.heading ? ` · טס ל${p.heading}` : ''}
            </span>
          </section>
        ))}

        {ground.length > 0 && (
          <section className="card">
            <h2>על הקרקע ({ground.length})</h2>
            {ground.map((p) => (
              <div key={p.id} className="row">
                <span>{p.callsign || p.registration || 'ללא זיהוי'}{p.airline ? ` · ${p.airline}` : ''}</span>
                <span className="muted">{p.type ? (AIRCRAFT[p.type] || p.type) : ''}</span>
              </div>
            ))}
          </section>
        )}

        {data && <p className="small muted" style={{ margin: 0 }}>נתונים בזמן אמת מרשת ADS-B (adsb.lol), מתעדכנים כל 20 שניות · {agoLabel(now - Date.parse(data.at))}. מטוסים צבאיים או פרטיים לא תמיד משדרים זיהוי.</p>}
      </div>
    </>
  );
}

function AirlineAlert({ f, goStatus }) {
  const r = assessFlight(f);
  if (!r || r.level === 'ok') return null;
  const bad = r.level === 'bad';
  return (
    <section className="card" style={{ background: bad ? '#FFD9D2' : 'var(--cream)', gap: 6 }} role="alert">
      <span className="strong" style={{ fontSize: 17, color: bad ? '#8A2412' : '#5C4A12' }}>{r.title}</span>
      {r.text && <span style={{ fontSize: 14, lineHeight: 1.55 }}>{r.text}</span>}
      <span style={{ fontSize: 14 }}>כדאי לבדוק מול חברת התעופה אם הטיסה שלך מתקיימת, ומה מגיע לך אם היא בוטלה.</span>
      <button type="button" className="btn-ghost" onClick={goStatus} style={{ alignSelf: 'flex-start' }}>מי עוד טס? ←</button>
    </section>
  );
}

function StatusTab() {
  const [q, setQ] = useState('');
  const list = AIRLINE_STATUS.airlines.filter((a, i, arr) => arr.findIndex((b) => b.name === a.name) === i);
  const match = (a) => !q || a.name.includes(q) || a.iata.includes(q.toUpperCase()) || (a.icao || '').includes(q.toUpperCase());
  const suspended = list.filter((a) => a.status === 'suspended' && match(a));
  const returning = list.filter((a) => a.status === 'returning' && match(a));
  const flying = list.filter((a) => a.status === 'flying' && match(a));
  const routeIssues = list.filter((a) => (a.routes || []).some((r) => r.status === 'suspended') && match(a));

  const Row = ({ a, extra }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid #EAF1F7' }}>
      <div className="row">
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><AirlineLogo iata={a.iata} name={a.name} size={26} /><span className="strong">{a.name}</span></span>
        <span className="muted small">{a.iata}</span>
      </div>
      {extra && <span style={{ fontSize: 14 }}>{extra}</span>}
      {a.note && <span className="muted" style={{ fontSize: 13 }}>{a.note}</span>}
    </div>
  );

  return (
    <>
      <header className="hero short" style={{ background: skyTheme('Asia/Jerusalem', Date.now()).bg, color: skyTheme('Asia/Jerusalem', Date.now()).ink }}>
        <Sky theme={skyTheme('Asia/Jerusalem', Date.now())} />
        <span className="pill">עודכן {heDate(AIRLINE_STATUS.updatedAt)} ✦</span>
        <h1>מי טס עכשיו?</h1>
        <p>{flying.length} חברות טסות · {returning.length} חוזרות בקרוב · {suspended.length} לא טסות</p>
      </header>
      <div className="content flat">
        <div className="field">
          <label htmlFor="airlineSearch">חיפוש חברת תעופה</label>
          <input id="airlineSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="לדוגמה: וויז או LH" />
        </div>

        {suspended.length > 0 && (
          <section className="card" style={{ background: '#FFE9E4' }}>
            <h2>לא טסות כרגע לישראל</h2>
            {suspended.map((a) => <Row key={a.iata} a={a} extra={a.until ? `מושהה עד ${heDate(a.until)}` : 'מושהה עד הודעה חדשה'} />)}
          </section>
        )}

        {returning.length > 0 && (
          <section className="card cream">
            <h2>חוזרות בקרוב</h2>
            {returning.map((a) => <Row key={a.iata} a={a} extra={a.date ? `חוזרת ב-${heDate(a.date)}` : 'מועד החזרה טרם נקבע סופית'} />)}
          </section>
        )}

        {routeIssues.length > 0 && (
          <section className="card cream">
            <h2>קווים מושהים</h2>
            {routeIssues.flatMap((a) => (a.routes || []).filter((r) => r.status === 'suspended').map((r) => (
              <Row key={a.iata + r.iata} a={{ ...a, note: r.note }} extra={`${r.iata}${r.until ? ` · עד ${heDate(r.until)}` : ''}`} />
            )))}
          </section>
        )}

        <section className="card mint">
          <h2>טסות לישראל</h2>
          {flying.map((a) => <Row key={a.iata} a={a} />)}
        </section>

        <section className="card">
          <h2>מקורות</h2>
          {AIRLINE_STATUS.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--coral-ink)' }}>{s.title} ({heDate(s.date)})</a>
          ))}
          <span className="small muted">המצב משתנה מהר. לפני הטיסה תמיד כדאי לבדוק גם באתר של חברת התעופה.</span>
        </section>
      </div>
    </>
  );
}

function FlightsTab({ f, now, editing, setEditing, search, error, goAircraft, inbound, goStatus, goLive }) {
  const hasFlight = !!f;
  const st = hasFlight ? statusOf(f) : null;
  const fs = hasFlight ? flightState(f) : null;
  const stTone = hasFlight && f.statusEn ? (/CANCEL/.test(f.statusEn) ? 'bad' : f.statusEn === 'DELAYED' ? 'warn' : 'good') : st?.tone;
  const approx = (side) => (side.estimatedByUs && !side.actual ? 'כ-' : '');
  const t = hasFlight ? times(f) : null;
  const left = t?.arrAt ? Math.ceil((t.arrAt - now) / 60000) : null;
  const toDep = t?.depAt ? Math.ceil((t.depAt - now) / 60000) : null;
  const early = t?.arrAt && t?.arrSched ? Math.round((t.arrSched - t.arrAt) / 60000) : 0;

  let pill = 'מעקב טיסה';
  if (hasFlight) {
    if (fs.landed) pill = 'נחתה';
    else if (fs.departed) pill = 'בטיסה עכשיו';
    else if (toDep <= 0) pill = 'ממריאה בקרוב';
    else if (toDep > 0) pill = toDep > 1440 ? `עוד ${Math.round(toDep / 1440)} ימים` : `עוד ${minutesLabel(toDep)}`;
  }
  const title = hasFlight ? (f.liveOnly ? `${f.callsign} ${f.live?.isGround ? 'על הקרקע' : 'בשמיים!'}` : fs.landed ? 'נחתת!' : `טסים ל${cityOf(f.arrival)}!`) : 'לאן טסים?';

  const [seat, setSeat] = useState('');
  useEffect(() => { try { setSeat(localStorage.getItem('kanaf:seat') || ''); } catch {} }, []);
  const typeInfo = hasFlight && f.aircraft?.type ? TYPE_INFO[f.aircraft.type] : null;
  let boarding = null;
  if (hasFlight) {
    const dep = hhmm(f.departure.estimated || f.departure.scheduled);
    if (dep) {
      const mins = (Number(dep.slice(0, 2)) * 60 + Number(dep.slice(3, 5)) - 40 + 1440) % 1440;
      boarding = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }
  }
  const theme = skyTheme(f?.arrival?.timezone || 'Asia/Jerusalem', now);
  const destName = hasFlight && f.arrival.iata ? cityOf(f.arrival) : 'ישראל';

  return (
    <>
      <header className="hero" style={{ background: theme.bg, color: theme.ink }}>
        <Sky theme={theme} flyer />
        <span className="pill">{pill} ✦</span>
        <h1>{title}</h1>
        {theme.clock && <p style={{ fontSize: 14, opacity: 0.9 }}>עכשיו {theme.name} ב{destName} · {theme.clock}</p>}
        {hasFlight && !editing && (
          <button type="button" className="btn-dark" onClick={() => setEditing(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            שנה טיסה או תאריך
          </button>
        )}
      </header>

      <div className="content">
        {(editing || !hasFlight) && search}
        {error && <div className="error" role="alert">{error}</div>}

        {hasFlight && f.liveOnly && (
          <>
            <section className="card big">
              <div className="row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AirlineLogo iata={airIata(f)} name={f.airline} size={30} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="strong">{f.airline || f.callsign}</span>
                    <span className="muted small">אות קריאה {f.callsign}</span>
                  </span>
                </span>
                <span className="badge good">{f.live?.isGround ? 'על הקרקע' : 'באוויר'}</span>
              </div>
              <span style={{ fontSize: 15 }}>{f.aircraft?.type ? (AIRCRAFT[f.aircraft.type] || f.aircraft.type) : 'דגם לא ידוע'}{f.aircraft?.registration ? ` · ${f.aircraft.registration}` : ''}</span>
              {f.live && !f.live.isGround && (
                <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div className="tile"><span className="label">גובה</span><span className="value" style={{ fontSize: 17 }}>{(Math.round(f.live.altitudeM * 3.28084 / 100) * 100).toLocaleString('en-US')}</span></div>
                  <div className="tile"><span className="label">מהירות</span><span className="value" style={{ fontSize: 17 }}>{Math.round(f.live.speedKmh)}</span></div>
                  <div className="tile"><span className="label">מעל</span><span className="value" style={{ fontSize: 15 }}>{f.view?.over?.name || '—'}</span></div>
                </div>
              )}
              <button type="button" className="btn-sun" onClick={goLive} style={{ flex: 'none' }}>למסך בזמן הטיסה ←</button>
            </section>
            <div className="card cream" role="status" style={{ fontSize: 14, lineHeight: 1.55 }}>
              {f.liveOnlyReason === 'callsign'
                ? 'זה אות קריאה של מטוס ולא מספר טיסה, אז יש לנו רק מיקום חי, בלי זמנים, שער או יעד. כדי לראות את כל הפרטים, חפש לפי מספר הטיסה שבכרטיס.'
                : 'שירות הזמנים לא זמין כרגע, אז מוצג רק המיקום החי של המטוס, בלי זמנים, שער או יעד.'}
            </div>
          </>
        )}

        {hasFlight && !f.liveOnly && (
          <>
            {f.stale && (
              <div className="card cream" role="status" style={{ fontSize: 14 }}>
                שירות הזמנים לא זמין כרגע, אז מוצגים הנתונים האחרונים ששמרנו ({agoLabel(now - Date.parse(f.fetchedAt))}). המיקום החי ממשיך להתעדכן.
              </div>
            )}
            <AirlineAlert f={f} goStatus={goStatus} />
            <BoardingPass
              seed={`${f.flight}${f.date}`}
              label={`כרטיס טיסה ${f.flight} מ-${f.departure.iata} ל-${f.arrival.iata}`}
              front={
                <>
                  <div className="row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AirlineLogo iata={airIata(f)} name={f.airline} size={30} />
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="strong">{f.airline || f.flight}</span>
                        <span className="muted small">{f.flight} · {f.date}</span>
                      </span>
                    </span>
                    <span className={`badge ${stTone}`}>{f.statusHe || st.text}</span>
                  </div>
                  <div className="route">
                    <div className="end">
                      <span className="code">{f.departure.iata}</span>
                      <span className="muted" style={{ fontSize: 13 }}>{cityOf(f.departure)}</span>
                      <span className="strong" style={{ fontSize: 15 }}>{f.departure.actual ? 'המריאה ' : ''}{approx(f.departure)}{hhmm(f.departure.actual || f.departure.estimated || f.departure.scheduled)}</span>
                    </div>
                    <div className="mid" aria-hidden="true">
                      <div className="dots" /><div className="plane-dot"><PlaneIcon color="#fff" /></div><div className="dots" />
                    </div>
                    <div className="end left">
                      <span className="code">{f.arrival.iata}</span>
                      <span className="muted" style={{ fontSize: 13 }}>{cityOf(f.arrival)}</span>
                      <span className="strong" style={{ fontSize: 15 }}>{f.arrival.actual ? 'נחתה ' : ''}{approx(f.arrival)}{hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled)}</span>
                    </div>
                  </div>
                  <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <div className="tile"><span className="label">טרמינל</span><span className="value">{f.departure.terminal || f.arrival.terminal || '—'}</span></div>
                    <div className="tile"><span className="label">שער</span>{f.departure.gate ? <span className="value">{f.departure.gate}</span> : (fs.departed || f.source === 'iaa') ? <span className="value" style={{ color: '#8AA0B8' }}>—</span> : <span className="soon">בקרוב</span>}</div>
                    <div className="tile"><span className="label">מושב</span><span className="value" style={{ color: seat ? 'var(--ink)' : '#8AA0B8' }}>{seat || '—'}</span></div>
                    <div className="tile"><span className="label">עלייה*</span><span className="value">{(!f.departure.estimatedByUs && boarding) || '—'}</span></div>
                  </div>
                  {f.departure.checkin && <span className="strong" style={{ fontSize: 14, marginTop: -6 }}>דלפקי צ׳ק-אין: {f.departure.checkin}{f.departure.checkinZone ? ` · אזור ${f.departure.checkinZone}` : ''}</span>}
                  <span className="small muted" style={{ marginTop: -8 }}>* שעת עלייה משוערת, כ-40 דק׳ לפני ההמראה. השעה הקובעת היא זו שבכרטיס שלך.{(f.departure.estimatedByUs || f.arrival.estimatedByUs) ? ' "כ-" = הערכה שלנו לפי המרחק.' : ''}</span>
                </>
              }
              back={
                <>
                  <div className="row">
                    <span className="strong" style={{ fontSize: 17 }}>המטוס של הטיסה</span>
                    <AirlineLogo iata={airIata(f)} name={f.airline} size={26} />
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{f.aircraft?.type ? (AIRCRAFT[f.aircraft.type] || f.aircraft.type) : 'עוד לא שובץ מטוס'}</span>
                  {f.aircraft?.registration && <span className="muted">רישום: {f.aircraft.registration}</span>}
                  {typeInfo && (
                    <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                      <div className="tile"><span className="label">אורך</span><span className="value" style={{ fontSize: 17 }}>{typeInfo.lengthM} מ׳</span></div>
                      <div className="tile"><span className="label">מוטת כנפיים</span><span className="value" style={{ fontSize: 17 }}>{typeInfo.spanM} מ׳</span></div>
                      <div className="tile"><span className="label">תצורה</span><span className="value" style={{ fontSize: 17, direction: 'ltr', textAlign: 'right' }}>{typeInfo.layout}</span></div>
                    </div>
                  )}
                  {seat && typeInfo && seatSide(seat, typeInfo.layout) && <span className="strong" style={{ color: 'var(--good)' }}>מושב {seat}: {seatSide(seat, typeInfo.layout).text}</span>}
                  {typeInfo?.fact && <span style={{ fontSize: 14, lineHeight: 1.55 }}>✦ {typeInfo.fact}</span>}
                </>
              }
            />

            {f.source === 'iaa' && f.direction === 'departure' && !fs.departed && f.status !== 'cancelled' && (
              <section className="card cream" style={{ gap: 4 }}>
                <span className="strong">איפה השער?</span>
                <span style={{ fontSize: 14, color: '#5C4A12', lineHeight: 1.5 }}>הלוח של רשות שדות התעופה לא מפרסם שערים. השער מופיע על המסכים בטרמינל ובאפליקציה של חברת התעופה, בדרך כלל כשעה וחצי לפני ההמראה.</span>
              </section>
            )}

            {f.source !== 'iaa' && !f.departure.gate && f.status === 'scheduled' && (
              <section className="card cream note">
                <div className="icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E2A47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="strong">השער עוד לא פורסם</span>
                  <span style={{ fontSize: 14, color: '#5C4A12', lineHeight: 1.5 }}>הוא נקבע בדרך כלל כמה שעות לפני ההמראה.</span>
                </div>
              </section>
            )}

            {f.aircraft?.type && (
              <button type="button" className="card peach" onClick={goAircraft} style={{ border: 'none', textAlign: 'right', cursor: 'pointer', flexDirection: 'row', alignItems: 'center', gap: 14, color: 'inherit' }}>
                <div className="plane-dot" style={{ width: 54, height: 54, borderRadius: 18 }}><span style={{ color: '#fff', display: 'flex' }}><TopIcon /></span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                  <span style={{ fontSize: 13, color: '#6B3A2A' }}>תטוס ב-</span>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{AIRCRAFT[f.aircraft.type] || f.aircraft.type}{f.aircraft.registration ? ` · ${f.aircraft.registration}` : ''}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--coral-ink)' }}>הכר את המטוס שלך ←</span>
                </div>
              </button>
            )}

            {!fs.departed && f.aircraft?.registration && <InboundCard f={f} inbound={inbound} now={now} />}

            <section className="card">
              <h2>הזמנים</h2>
              <div className="row"><span className="muted">{f.departure.estimatedByUs ? 'המראה משוערת (לפי המרחק, שעון מקומי)' : 'המראה מתוכננת'}</span><span className="strong">{approx(f.departure)}{hhmm(f.departure.estimated || f.departure.scheduled)}</span></div>
              {f.source === 'iaa' && f.direction === 'departure' && !f.departure.actual && f.departure.delay > 0 && (
                <div className="row"><span className="muted">שעה מעודכנת</span><span className="strong" style={{ color: 'var(--coral-ink)' }}>{hhmm(f.departure.estimated)} · איחור {f.departure.delay} דק׳</span></div>
              )}
              {f.departure.actual && (
                <div className="row"><span className="muted">המראה בפועל</span><span className="strong" style={{ color: f.departure.delay > 0 ? 'var(--coral-ink)' : 'var(--good)' }}>{hhmm(f.departure.actual)}{f.departure.delay > 0 ? ` · איחור ${f.departure.delay} דק׳` : ''}</span></div>
              )}
              {!f.arrival.estimatedByUs && <div className="row"><span className="muted">נחיתה מתוכננת (שעון מקומי)</span><span className="strong">{hhmm(f.arrival.scheduled)}</span></div>}
              <div className="row"><span className="muted">{f.arrival.actual ? 'נחיתה בפועל' : f.arrival.estimatedByUs ? 'נחיתה משוערת (לפי המרחק, שעון מקומי)' : 'נחיתה צפויה'}</span>
                <span className="strong" style={{ color: 'var(--good)' }}>
                  {approx(f.arrival)}{hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled)}
                  {!f.arrival.actual && left > 0 ? ` · עוד ${minutesLabel(left)}` : ''}
                  {early > 0 && !f.arrival.estimatedByUs ? ` · ${early} דק׳ מוקדם` : ''}
                </span>
              </div>
              {f.arrival.terminal && <div className="row"><span className="muted">טרמינל נחיתה</span><span className="strong">{f.arrival.terminal}</span></div>}
              <span className="small muted">{f.source === 'iaa' ? 'נתונים רשמיים מלוח נתב״ג של רשות שדות התעופה' : 'נתונים אמיתיים מ-Aviationstack'} · {agoLabel(now - Date.parse(f.fetchedAt))}</span>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function LiveTab({ f, now, onRefresh, loading }) {
  if (!f) {
    return (
      <>
        <header className="hero short"><h1>בזמן הטיסה</h1></header>
        <div className="content flat"><div className="card">חפש טיסה בלשונית "טיסות" כדי לראות כאן נתונים חיים.</div></div>
      </>
    );
  }
  const t = times(f);
  const { departed, landed } = flightState(f);
  const total = t.arrAt && t.depAt ? t.arrAt - t.depAt : null;
  let progress = 0;
  if (landed) progress = 1;
  else if (departed && total) progress = Math.min(0.99, Math.max(0.01, (now - t.depAt) / total));
  const left = t.arrAt ? Math.ceil((t.arrAt - now) / 60000) : null;
  const live = f.live;
  let mySide = null;
  try {
    const seat = localStorage.getItem('kanaf:seat');
    const info = TYPE_INFO[f.aircraft?.type];
    mySide = seatSide(seat, info ? info.layout : '3-3')?.side || null;
  } catch {}

  let phase = 0;
  let phaseEstimated = false;
  if (landed) phase = 4;
  else if (departed) {
    if (live && !live.isGround && live.verticalKmh > 3) phase = 1;
    else if (live && !live.isGround && live.verticalKmh < -3) phase = 3;
    else if (live && !live.isGround) phase = 2;
    else {
      phaseEstimated = true;
      const since = (now - t.depAt) / 60000, until = (t.arrAt - now) / 60000;
      phase = since < 20 ? 1 : until < 25 ? 3 : 2;
    }
  }
  const depTime = hhmm(f.departure.actual || f.departure.estimated || f.departure.scheduled);
  const phaseNames = ['המראה', 'טיפוס', 'שיוט', 'ירידה', 'נחיתה'];
  const phaseText = [
    `המטוס עוד על הקרקע. ההמראה מתוכננת ל-${depTime}.`,
    'המטוס מטפס לגובה השיוט. המנועים עובדים חזק, וזה רגיל לגמרי.',
    'הטייס האוטומטי מחזיק גובה ומהירות קבועים. שינויים קלים ברעש המנועים הם תיקונים רגילים.',
    'המטוס יורד בהדרגה ומאט. לחץ קל באוזניים הוא רגיל, ובליעה או פיהוק עוזרים.',
    'נחתת. ברוך הבא!'
  ];
  const title = landed ? `${f.flight} נחתה` : departed ? `${f.flight} בשמיים!` : `${f.flight} לפני המראה`;

  const liveTheme = skyTheme(f.arrival?.timezone || 'Asia/Jerusalem', now);
  // נקודה על קשת המסלול
  const p = progress, x = (1 - p) ** 2 * 330 + 2 * p * (1 - p) * 175 + p * p * 20;
  const y = (1 - p) ** 2 * 84 + 2 * p * (1 - p) * -14 + p * p * 84;

  return (
    <>
      <header className="hero short" style={{ background: liveTheme.bg, color: liveTheme.ink }}>
        <Sky theme={liveTheme} />
        <div className="row">
          <h1 style={{ fontSize: 30, display: 'flex', alignItems: 'center', gap: 10 }}><AirlineLogo iata={airIata(f)} name={f.airline} size={30} />{title}</h1>
          <span className="pill">{agoLabel(now - Date.parse(live?.updated || f.fetchedAt))}</span>
        </div>
        <svg width="100%" height="100" viewBox="0 0 350 100" style={{ position: 'relative', overflow: 'visible' }} role="img" aria-label={`התקדמות הטיסה: ${Math.round(progress * 100)} אחוז`}>
          <path d="M330 84 Q175 -14 20 84" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
          <path d="M330 84 Q175 -14 20 84" pathLength="100" strokeDasharray={`${progress * 100} 100`} fill="none" stroke={liveTheme.ink} strokeWidth="4" strokeLinecap="round" style={{ transition: 'stroke-dasharray 2s ease-in-out' }} />
          <circle cx="330" cy="84" r="7" fill={liveTheme.ink} />
          <circle cx="20" cy="84" r="7" fill="#fff" />
          <ArcPlane progress={progress} />
        </svg>
        <div className="row strong"><span>{f.departure.iata}</span><span>{f.arrival.iata}</span></div>
      </header>

      <div className="content flat">
        <section className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="small muted">סטטוס</span>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{statusOf(f).text}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            <span className="small muted">{departed && !landed ? 'נותרו' : landed ? 'שעת נחיתה' : 'המראה מתוכננת'}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--coral-ink)' }}>{landed ? (hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled) || '—') : departed ? (left == null ? '—' : left > 0 ? minutesLabel(left) : 'עוד רגע') : (depTime || '—')}</span>
          </div>
        </section>

        {f.view?.over && (
          <section className="card big" style={{ gap: 6 }}>
            <span className="small muted">{live && !live.isGround ? 'אתה עכשיו מעל' : 'המטוס נמצא ב'}</span>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{f.view.over.name}</span>
          </section>
        )}

        {f.view?.left && f.view?.right && (
          <section className="card mint">
            <h2>מה רואים מהחלון</h2>
            {[['שמאל', f.view.left, true, 'left'], ['ימין', f.view.right, false, 'right']].map(([label, s, dark, sideKey]) => (
              <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="badge" style={{ background: dark ? 'var(--ink)' : '#fff', color: dark ? '#fff' : 'var(--ink)', flexShrink: 0 }}>{label}{mySide === sideKey ? ' · הצד שלך' : ''}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14, lineHeight: 1.5 }}>
                  <span className="strong">{s.area.name}</span>
                  {s.sights.length > 0
                    ? s.sights.map((x) => <span key={x.name}>{x.name} · כ-{x.km} ק״מ</span>)
                    : <span className="muted">אין נקודות ציון מוכרות בטווח הראייה</span>}
                </div>
              </div>
            ))}
            <span className="small muted">טווח ראייה מהגובה הנוכחי: עד כ-{f.view.visibleKm} ק״מ, אם אין עננים. מושב A הוא בדרך כלל חלון בצד שמאל.</span>
          </section>
        )}

        {live && !live.isGround ? (
          <div className="tiles two">
            <div className="tile"><span className="label">גובה</span><span className="value">{(Math.round(live.altitudeM * 3.28084 / 100) * 100).toLocaleString('en-US')} רגל</span><span className="small muted">כ-{(live.altitudeM / 1000).toFixed(1)} ק״מ</span></div>
            <div className="tile"><span className="label">מהירות קרקע</span><span className="value">{Math.round(live.speedKmh)} קמ״ש</span></div>
            <div className="tile"><span className="label">כיוון טיסה</span><span className="value">{Math.round(live.direction)}°</span></div>
            {typeof live.outsideC === 'number'
              ? <div className="tile"><span className="label">טמפרטורה בחוץ</span><span className="value">{'\u200e'}{Math.round(live.outsideC)}°C</span></div>
              : <div className="tile"><span className="label">מיקום</span><span className="value" style={{ fontSize: 16 }}>{live.latitude.toFixed(2)}°, {live.longitude.toFixed(2)}°</span></div>}
          </div>
        ) : (
          <div className="card cream">{landed ? 'הטיסה נחתה.' : departed ? 'מיקום חי עוד לא התקבל מהמקור. נסה לרענן בעוד כמה דקות.' : 'המיקום החי יופיע אחרי ההמראה.'}</div>
        )}

        <section className="card">
          <div className="phases">
            {phaseNames.map((n, i) => (
              <div key={n} className={`phase ${i < phase ? 'done' : ''} ${i === phase ? 'now' : ''}`}><div />{n}</div>
            ))}
          </div>
          <span className="strong">עכשיו: {phase === 0 ? 'לפני המראה' : phaseNames[phase]}{phaseEstimated ? ' (הערכה לפי הזמן)' : ''}</span>
          <span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{phaseText[phase]}</span>
        </section>

        <button type="button" className="btn-sun" onClick={onRefresh} disabled={loading} style={{ flex: 'none' }}>{loading ? 'מרענן…' : 'רענן נתונים'}</button>
        <p className="small muted" style={{ margin: 0 }}>הזמן שנותר מחושב לפי שעת הנחיתה הצפויה ומתעדכן כל 30 שניות. {f.liveSource === 'adsb' ? 'המיקום החי מגיע בזמן אמת מרשת ADS-B (adsb.lol) ומתעדכן כל 15 שניות.' : 'הנתונים מהמקור מתעדכנים בכל רענון, בהפרש של כמה דקות.'}
          {f.broadcastCallsign && f.callsign && f.broadcastCallsign !== f.callsign ? ` המטוס משדר כ-${f.broadcastCallsign}${f.matchedByRoute ? ', וזיהינו אותו לפי החברה וכיוון הטיסה' : ''}.` : ''}</p>
      </div>
    </>
  );
}

function SeatMap({ layout, seat }) {
  const blocks = seatBlocks(layout);
  const mine = seatSide(seat, layout);
  const rows = 8;
  const wingRows = [3, 4, 5];
  return (
    <div role="img" aria-label={`תרשים מושבים טיפוסי בתצורה ${layout}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', direction: 'ltr' }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {blocks.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 4 }}>
            {b.map((l) => <span key={l} style={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{l}</span>)}
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative' }}>
          {wingRows.includes(r) && <div aria-hidden="true" style={{ position: 'absolute', left: -26, right: -26, top: 6, height: 12, background: '#DDEBF6', borderRadius: 6, zIndex: 0 }} />}
          {blocks.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, zIndex: 1 }}>
              {b.map((l) => {
                const hit = mine && mine.letter === l && r === 4;
                return <span key={l} style={{ width: 24, height: 24, borderRadius: 7, background: hit ? 'var(--coral)' : '#fff', border: `2px solid ${hit ? 'var(--coral)' : '#CFE6F7'}` }} />;
              })}
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 12, color: 'var(--muted)', direction: 'rtl' }}>
        <span>צד ימין</span><span>↑ חרטום המטוס</span><span>צד שמאל</span>
      </div>
    </div>
  );
}

function WhereIsPlane({ f, inbound, now }) {
  const reg = f?.aircraft?.registration;
  if (!reg) return null;
  const { departed, landed } = flightState(f);
  if (departed && !landed && f.live && !f.live.isGround) {
    return (
      <section className="card mint">
        <h2>איפה המטוס עכשיו</h2>
        <span className="strong">המטוס בטיסה שלך, {f.flight}</span>
        <span style={{ fontSize: 14 }}>{f.view?.over?.name ? `מעל ${f.view.over.name} · ` : ''}{(Math.round(f.live.altitudeM * 3.28084 / 100) * 100).toLocaleString('en-US')} רגל · {Math.round(f.live.speedKmh)} קמ״ש</span>
      </section>
    );
  }
  if (inbound && !inbound.error && inbound.state !== 'is_our_flight') return <InboundCard f={f} inbound={inbound} now={now} />;
  return null;
}

function AircraftPhoto({ reg }) {
  const [photo, setPhoto] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setPhoto(null); setFailed(false);
    if (!reg) return;
    let stop = false;
    fetch(`/api/photo?reg=${encodeURIComponent(reg)}`).then((r) => r.json()).then((b) => { if (!stop) setPhoto(b); }).catch(() => {});
    return () => { stop = true; };
  }, [reg]);
  if (!reg || !photo?.found || failed) return null;
  return (
    <figure className="card" style={{ margin: 0, padding: 0, overflow: 'hidden', gap: 0 }}>
      <img
        src={photo.src}
        alt={`המטוס ${reg}${photo.photographer ? `, צילום: ${photo.photographer}` : ''}`}
        width={photo.width || undefined}
        height={photo.height || undefined}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : '3 / 2', objectFit: 'cover', background: '#DCEFFB' }}
      />
      <figcaption style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>המטוס האמיתי, {reg}</span>
        {photo.link
          ? <a href={photo.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--coral-ink)' }}>© {photo.photographer || 'צלם'} / Planespotters.net</a>
          : <span>© {photo.photographer || 'צלם'} / Planespotters.net</span>}
      </figcaption>
    </figure>
  );
}

function AircraftTab({ f, back, inbound, now }) {
  const type = f?.aircraft?.type;
  const info = type ? TYPE_INFO[type] : null;
  const [seat, setSeat] = useState('');
  useEffect(() => { try { setSeat(localStorage.getItem('kanaf:seat') || ''); } catch {} }, []);
  const saveSeat = (v) => { const x = v.toUpperCase().replace(/\s+/g, ''); setSeat(x); try { localStorage.setItem('kanaf:seat', x); } catch {} };
  const mine = info ? seatSide(seat, info.layout) : null;

  return (
    <>
      <header className="hero peach short">
        <div className="sun" style={{ opacity: 0.85 }} aria-hidden="true" />
        <button type="button" className="pill" onClick={back} style={{ border: 'none', cursor: 'pointer', fontSize: 15 }}>→ לטיסה שלי</button>
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="110" height="110" viewBox="0 0 24 24" fill="#fff" stroke="#0E2A47" strokeWidth="0.7" style={{ transform: 'rotate(-35deg)' }} aria-hidden="true">
            <path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" />
          </svg>
        </div>
        {f && <AirlineLogo iata={airIata(f)} name={f.airline} size={34} />}
        <h1 style={{ fontSize: 28 }}>{type ? (AIRCRAFT[type] || type) : 'המטוס שלך'}</h1>
        <p style={{ color: '#4A2212' }}>{f?.airline ? `${f.airline} · ` : ''}{f?.aircraft?.registration ? `רישום: ${f.aircraft.registration}` : 'הרישום יופיע כשחברת התעופה תשבץ מטוס'}{info ? ` · ${info.body}` : ''}</p>
      </header>
      <div className="content flat">
        <AircraftPhoto reg={f?.aircraft?.registration} />
        {f && <WhereIsPlane f={f} inbound={inbound} now={now} />}

        {info ? (
          <>
            <div className="tiles two">
              <div className="tile"><span className="label">אורך</span><span className="value">{info.lengthM} מ׳</span></div>
              <div className="tile"><span className="label">מוטת כנפיים</span><span className="value">{info.spanM} מ׳</span></div>
              <div className="tile"><span className="label">טיסה ראשונה של הדגם</span><span className="value">{info.firstFlight}</span></div>
              <div className="tile"><span className="label">תצורה טיפוסית</span><span className="value" style={{ direction: 'ltr', textAlign: 'right' }}>{info.layout}</span></div>
            </div>

            <section className="card cream">
              <span className="strong" style={{ color: '#7A5A00' }}>✦ הידעת?</span>
              <span style={{ lineHeight: 1.55 }}>{info.fact}</span>
            </section>

            <section className="card">
              <h2>איפה אני יושב?</h2>
              <div className="field">
                <label htmlFor="seatNo">מספר המושב שלך</label>
                <input id="seatNo" value={seat} onChange={(e) => saveSeat(e.target.value)} placeholder="לדוגמה 32A" maxLength={3} />
              </div>
              {mine && (
                <span className="strong" style={{ fontSize: 16, color: mine.kind === 'window' ? 'var(--good)' : 'var(--ink)' }}>
                  {seat}: {mine.text}{mine.kind === 'window' ? ' · בלשונית "בטיסה" תראה מה רואים מהצד שלך' : ''}
                </span>
              )}
              {seat && !mine && <span className="muted" style={{ fontSize: 14 }}>לא הצלחנו לזהות את המושב. כתוב מספר שורה ואות, למשל 32A.</span>}
              <SeatMap layout={info.layout} seat={seat} />
              <span className="small muted">תרשים כללי של תצורה {info.layout}, לא המפה של חברת התעופה שלך. הפס הכחול מסמן בערך את אזור הכנף. החברות משנות את מספר השורות ואת האותיות, אבל A הוא כמעט תמיד חלון בצד שמאל.</span>
              <a href="https://www.aerolopa.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 700, color: 'var(--coral-ink)' }}>מפת מושבים מדויקת לפי חברת תעופה (aeroLOPA) ←</a>
            </section>
          </>
        ) : (
          <section className="card cream">
            <span style={{ lineHeight: 1.55 }}>{type ? 'אין לנו עדיין נתונים על הדגם הזה.' : 'כשחברת התעופה תשבץ מטוס לטיסה, יופיעו כאן הדגם, הנתונים ותרשים המושבים.'}</span>
          </section>
        )}
      </div>
    </>
  );
}

export default function Home() {
  const [flightNo, setFlightNo] = useState('LY315');
  const [date, setDate] = useState('');
  const [flight, setFlight] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('flights');
  const [now, setNow] = useState(Date.now());
  const [adsb, setAdsb] = useState(null);
  const [wasAirborne, setWasAirborne] = useState(false);

  const search = useCallback(async (no, d) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/flight?flight=${encodeURIComponent(no)}&date=${encodeURIComponent(d)}`);
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'משהו השתבש'); }
      else { setFlight(body); setEditing(false); try { localStorage.setItem('kanaf:last', JSON.stringify({ no, d })); } catch {} }
    } catch {
      setError('אין חיבור לאינטרנט');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let no = 'LY315', d = todayIn();
    try { const last = JSON.parse(localStorage.getItem('kanaf:last') || 'null'); if (last?.no) { no = last.no; d = last.d || d; } } catch {}
    setFlightNo(no); setDate(d);
    search(no, d);
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [search]);

  // מיקום חי בזמן אמת מ-adsb.lol, כל 15 שניות כשהדף פתוח
  const altCallsign = useRef(null);
  const callsign = flight?.callsign;
  const flightReg = flight?.aircraft?.registration;
  useEffect(() => {
    setAdsb(null); setWasAirborne(false); altCallsign.current = null;
    if (!callsign) return;
    let stop = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const q = new URLSearchParams({ callsign, reg: flightReg || '', alt: altCallsign.current || '' });
        if (flight?.source === 'iaa') {
          q.set('from', flight.departure.iata || ''); q.set('to', flight.arrival.iata || ''); q.set('dir', flight.direction || 'departure');
          const eta = localToInstant(flight.arrival.estimated || flight.arrival.scheduled, flight.arrival.timezone);
          if (eta) q.set('eta', String(eta));
        }
        const res = await fetch(`/api/live?${q}`);
        const body = await res.json();
        if (!stop && res.ok && body.found) {
          setAdsb(body);
          if (body.broadcastCallsign) altCallsign.current = body.broadcastCallsign;
          if (!body.live.isGround) setWasAirborne(true);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { stop = true; clearInterval(id); };
  }, [callsign, flightReg]);

  // "המטוס הגיע?": בדיקה כל דקה, רק לפני ההמראה
  const [inbound, setInbound] = useState(null);
  const reg = adsb?.registration || flight?.aircraft?.registration;
  const departed = !!flight?.departure?.actual || wasAirborne;
  useEffect(() => {
    setInbound(null);
    if (!reg || !flight || departed) return;
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const q = `reg=${encodeURIComponent(reg)}&from=${encodeURIComponent(flight.departure.iata)}&callsign=${encodeURIComponent(flight.callsign || '')}`;
        const res = await fetch(`/api/inbound?${q}`);
        const body = await res.json();
        if (!stop && res.ok) setInbound(body);
      } catch {}
    };
    load();
    const id = setInterval(load, 60000);
    return () => { stop = true; clearInterval(id); };
  }, [reg, flight?.flight, flight?.date, departed]);

  const landedBySource = flight?.status === 'landed' || !!flight?.arrival?.actual;
  const view = flight && adsb && !(landedBySource && !adsb.live.isGround)
    ? {
        ...flight,
        live: adsb.live,
        view: adsb.view,
        liveSource: 'adsb',
        broadcastCallsign: adsb.broadcastCallsign,
        matchedByRoute: adsb.matchedByRoute,
        wasAirborne,
        aircraft: {
          type: flight.aircraft?.type || adsb.type,
          registration: adsb.registration || flight.aircraft?.registration
        }
      }
    : flight;

  const searchCard = (
    <SearchCard flightNo={flightNo} setFlightNo={setFlightNo} date={date} setDate={setDate} loading={loading}
      onSearch={() => search(flightNo, date)} onCancel={flight ? () => setEditing(false) : null} />
  );

  return (
    <main className="app">
      {tab === 'flights' && <FlightsTab f={view} now={now} editing={editing} setEditing={setEditing} search={searchCard} error={error} goAircraft={() => setTab('aircraft')} inbound={inbound} goStatus={() => setTab('status')} goLive={() => setTab('live')} />}
      {tab === 'live' && <LiveTab f={view} now={now} loading={loading} onRefresh={() => search(flightNo, date)} />}
      {tab === 'nearby' && <NearbyTab now={now} />}
      {tab === 'status' && <StatusTab />}
      {tab === 'aircraft' && <AircraftTab f={view} back={() => setTab('flights')} inbound={inbound} now={now} />}

      <nav className="nav" aria-label="ניווט ראשי">
        <button type="button" className={tab === 'flights' ? 'active' : ''} onClick={() => setTab('flights')}><span><PlaneIcon /></span>טיסות</button>
        <button type="button" className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}><span><GaugeIcon /></span>בטיסה</button>
        <button type="button" className={tab === 'nearby' ? 'active' : ''} onClick={() => setTab('nearby')}><span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg></span>מעליי</button>
        <button type="button" className={tab === 'status' ? 'active' : ''} onClick={() => setTab('status')}><span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18h3" /></svg></span>מי טס</button>
      </nav>
    </main>
  );
}
