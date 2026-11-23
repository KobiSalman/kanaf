'use client';

import { useCallback, useEffect, useState } from 'react';
import { hhmm, localToInstant, todayIn, minutesLabel, agoLabel } from '../lib/time';

const STATUS = {
  scheduled: { text: 'מתוכננת', tone: 'good' },
  active: { text: 'בטיסה', tone: 'good' },
  landed: { text: 'נחתה', tone: 'good' },
  cancelled: { text: 'בוטלה', tone: 'bad' },
  incident: { text: 'אירוע', tone: 'bad' },
  diverted: { text: 'הוסטה', tone: 'warn' }
};

const AIRCRAFT = {
  B789: 'Boeing 787-9 Dreamliner', B788: 'Boeing 787-8 Dreamliner', B78X: 'Boeing 787-10 Dreamliner',
  B738: 'Boeing 737-800', B739: 'Boeing 737-900', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9',
  B77W: 'Boeing 777-300ER', B772: 'Boeing 777-200', B763: 'Boeing 767-300', B744: 'Boeing 747-400', B748: 'Boeing 747-8',
  A320: 'Airbus A320', A20N: 'Airbus A320neo', A321: 'Airbus A321', A21N: 'Airbus A321neo', A319: 'Airbus A319',
  A333: 'Airbus A330-300', A332: 'Airbus A330-200', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000', A388: 'Airbus A380',
  E190: 'Embraer E190', E195: 'Embraer E195', E75L: 'Embraer E175', AT76: 'ATR 72-600'
};

const CITY = {
  TLV: 'תל אביב', ETM: 'אילת', LHR: 'לונדון', LTN: 'לונדון', STN: 'לונדון', LGW: 'לונדון', CDG: 'פריז', ORY: 'פריז',
  JFK: 'ניו יורק', EWR: 'ניו יורק', FCO: 'רומא', MXP: 'מילאנו', ATH: 'אתונה', BCN: 'ברצלונה', MAD: 'מדריד',
  BER: 'ברלין', MUC: 'מינכן', FRA: 'פרנקפורט', AMS: 'אמסטרדם', VIE: 'וינה', PRG: 'פראג', BUD: 'בודפשט',
  ZRH: 'ציריך', IST: 'איסטנבול', LCA: 'לרנקה', DXB: 'דובאי', AUH: 'אבו דאבי', BKK: 'בנגקוק', LAX: 'לוס אנג׳לס',
  MIA: 'מיאמי', SFO: 'סן פרנסיסקו', BOS: 'בוסטון', YYZ: 'טורונטו', LIS: 'ליסבון', WAW: 'ורשה', BUH: 'בוקרשט',
  OTP: 'בוקרשט', SOF: 'סופיה', TBS: 'טביליסי', LED: 'סנט פטרבורג', HND: 'טוקיו', NRT: 'טוקיו', DEL: 'דלהי', BOM: 'מומבאי'
};
const cityOf = (side) => CITY[side.iata] || side.iata;

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

function flightState(f) {
  const departed = !!f.departure.actual || !!(f.live && !f.live.isGround) || !!f.wasAirborne;
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

function FlightsTab({ f, now, editing, setEditing, search, error, goAircraft }) {
  const hasFlight = !!f;
  const st = hasFlight ? statusOf(f) : null;
  const fs = hasFlight ? flightState(f) : null;
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
  const title = hasFlight ? (fs.landed ? 'נחתת!' : `טסים ל${CITY[f.arrival.iata] ? cityOf(f.arrival) : '-' + f.arrival.iata}!`) : 'לאן טסים?';

  return (
    <>
      <header className="hero">
        <Clouds />
        <span className="pill">{pill} ✦</span>
        <h1>{title}</h1>
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

        {hasFlight && (
          <>
            <section className="card big">
              <div className="row">
                <span className="muted">{f.date} · {f.flight}{f.airline ? ` · ${f.airline}` : ''}</span>
                <span className={`badge ${st.tone}`}>{st.text}</span>
              </div>
              <div className="route">
                <div className="end">
                  <span className="code">{f.departure.iata}</span>
                  <span className="muted" style={{ fontSize: 14 }}>{f.departure.actual ? 'המריאה ' : ''}{hhmm(f.departure.actual || f.departure.estimated || f.departure.scheduled)}</span>
                </div>
                <div className="mid" aria-hidden="true">
                  <div className="dots" /><div className="plane-dot"><PlaneIcon color="#fff" /></div><div className="dots" />
                </div>
                <div className="end left">
                  <span className="code">{f.arrival.iata}</span>
                  <span className="muted" style={{ fontSize: 14 }}>{f.arrival.actual ? 'נחתה ' : 'צפויה '}{hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled)}</span>
                </div>
              </div>
              <div className="tiles">
                <div className="tile"><span className="label">טרמינל</span><span className="value">{f.departure.terminal || '—'}</span></div>
                <div className="tile"><span className="label">שער</span>{f.departure.gate ? <span className="value">{f.departure.gate}</span> : <span className="soon">בקרוב</span>}</div>
                <div className="tile"><span className="label">מושב</span><span className="value" style={{ color: '#8AA0B8' }}>—</span></div>
              </div>
            </section>

            {!f.departure.gate && f.status === 'scheduled' && (
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

            <section className="card">
              <h2>הזמנים</h2>
              <div className="row"><span className="muted">המראה מתוכננת</span><span className="strong">{hhmm(f.departure.scheduled)}</span></div>
              {f.departure.actual && (
                <div className="row"><span className="muted">המראה בפועל</span><span className="strong" style={{ color: f.departure.delay > 0 ? 'var(--coral-ink)' : 'var(--good)' }}>{hhmm(f.departure.actual)}{f.departure.delay > 0 ? ` · איחור ${f.departure.delay} דק׳` : ''}</span></div>
              )}
              <div className="row"><span className="muted">נחיתה מתוכננת (שעון מקומי)</span><span className="strong">{hhmm(f.arrival.scheduled)}</span></div>
              <div className="row"><span className="muted">{f.arrival.actual ? 'נחיתה בפועל' : 'נחיתה צפויה'}</span>
                <span className="strong" style={{ color: 'var(--good)' }}>
                  {hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled)}
                  {!f.arrival.actual && left > 0 ? ` · עוד ${minutesLabel(left)}` : ''}
                  {early > 0 ? ` · ${early} דק׳ מוקדם` : ''}
                </span>
              </div>
              {f.arrival.terminal && <div className="row"><span className="muted">טרמינל נחיתה</span><span className="strong">{f.arrival.terminal}</span></div>}
              <span className="small muted">נתונים אמיתיים מ-Aviationstack · {agoLabel(now - Date.parse(f.live?.updated || f.fetchedAt))}</span>
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

  // נקודה על קשת המסלול
  const p = progress, x = (1 - p) ** 2 * 330 + 2 * p * (1 - p) * 175 + p * p * 20;
  const y = (1 - p) ** 2 * 84 + 2 * p * (1 - p) * -14 + p * p * 84;

  return (
    <>
      <header className="hero short">
        <div className="cloud" style={{ right: -20, top: 96, width: 130, height: 36, opacity: 0.7 }} aria-hidden="true" />
        <div className="row">
          <h1 style={{ fontSize: 30 }}>{title}</h1>
          <span className="pill">{agoLabel(now - Date.parse(live?.updated || f.fetchedAt))}</span>
        </div>
        <svg width="100%" height="100" viewBox="0 0 350 100" role="img" aria-label={`התקדמות הטיסה: ${Math.round(progress * 100)} אחוז`}>
          <path d="M330 84 Q175 -14 20 84" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
          <path d="M330 84 Q175 -14 20 84" pathLength="100" strokeDasharray={`${progress * 100} 100`} fill="none" stroke="#0E2A47" strokeWidth="4" strokeLinecap="round" />
          <circle cx="330" cy="84" r="7" fill="#0E2A47" />
          <circle cx="20" cy="84" r="7" fill="#fff" />
          <circle cx={x} cy={y} r="15" fill="#FF7A59" stroke="#fff" strokeWidth="3" />
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
            <span className="small muted">{departed && !landed ? 'נותרו' : landed ? 'נחיתה' : 'המראה מתוכננת'}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--coral-ink)' }}>{landed ? 'נחתה' : departed ? (left > 0 ? minutesLabel(left) : 'עוד רגע') : depTime}</span>
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
            {[['שמאל', f.view.left, true], ['ימין', f.view.right, false]].map(([label, s, dark]) => (
              <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="badge" style={{ background: dark ? 'var(--ink)' : '#fff', color: dark ? '#fff' : 'var(--ink)', flexShrink: 0 }}>{label}</span>
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
            <div className="tile"><span className="label">מיקום</span><span className="value" style={{ fontSize: 16 }}>{live.latitude.toFixed(2)}°, {live.longitude.toFixed(2)}°</span></div>
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
        <p className="small muted" style={{ margin: 0 }}>הזמן שנותר מחושב לפי שעת הנחיתה הצפויה ומתעדכן כל 30 שניות. {f.liveSource === 'adsb' ? 'המיקום החי מגיע בזמן אמת מרשת ADS-B (adsb.lol) ומתעדכן כל 15 שניות.' : 'הנתונים מהמקור מתעדכנים בכל רענון, בהפרש של כמה דקות.'}</p>
      </div>
    </>
  );
}

function AircraftTab({ f, back }) {
  const type = f?.aircraft?.type;
  return (
    <>
      <header className="hero peach short">
        <div className="sun" style={{ opacity: 0.85 }} aria-hidden="true" />
        <button type="button" className="pill" onClick={back} style={{ border: 'none', cursor: 'pointer', fontSize: 15 }}>→ לטיסה שלי</button>
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="#fff" stroke="#0E2A47" strokeWidth="0.7" style={{ transform: 'rotate(-35deg)' }} aria-hidden="true">
            <path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" />
          </svg>
        </div>
        <h1 style={{ fontSize: 28 }}>{type ? (AIRCRAFT[type] || type) : 'המטוס שלך'}</h1>
        <p style={{ color: '#4A2212' }}>{f?.aircraft?.registration ? `רישום: ${f.aircraft.registration}` : 'הרישום יופיע כשחברת התעופה תשבץ מטוס'}</p>
      </header>
      <div className="content flat">
        <section className="card cream">
          <span className="strong" style={{ color: '#7A5A00' }}>✦ בקרוב</span>
          <span style={{ lineHeight: 1.55 }}>כאן יופיעו נתונים טכניים, גיל המטוס ועובדות מעניינות על הדגם.</span>
        </section>
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
  const callsign = flight?.callsign;
  useEffect(() => {
    setAdsb(null); setWasAirborne(false);
    if (!callsign) return;
    let stop = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/live?callsign=${encodeURIComponent(callsign)}`);
        const body = await res.json();
        if (!stop && res.ok && body.found) {
          setAdsb(body);
          if (!body.live.isGround) setWasAirborne(true);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { stop = true; clearInterval(id); };
  }, [callsign]);

  const view = flight && adsb
    ? {
        ...flight,
        live: adsb.live,
        view: adsb.view,
        liveSource: 'adsb',
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
      {tab === 'flights' && <FlightsTab f={view} now={now} editing={editing} setEditing={setEditing} search={searchCard} error={error} goAircraft={() => setTab('aircraft')} />}
      {tab === 'live' && <LiveTab f={view} now={now} loading={loading} onRefresh={() => search(flightNo, date)} />}
      {tab === 'aircraft' && <AircraftTab f={view} back={() => setTab('flights')} />}

      <nav className="nav" aria-label="ניווט ראשי">
        <button type="button" className={tab === 'flights' ? 'active' : ''} onClick={() => setTab('flights')}><span><PlaneIcon /></span>טיסות</button>
        <button type="button" className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}><span><GaugeIcon /></span>בטיסה</button>
        <button type="button" className={tab === 'aircraft' ? 'active' : ''} onClick={() => setTab('aircraft')}><span><TopIcon /></span>המטוס</button>
      </nav>
    </main>
  );
}
