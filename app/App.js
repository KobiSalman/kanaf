'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { hhmm, localToInstant, todayIn, minutesLabel, agoLabel } from '../lib/time';
import { LeaveHomeCard, PickupCard, CrowdForecast } from './airport';
import { BrandBar } from './Logo';
import InstallHint from './InstallHint';
import NearbyMap from './NearbyMap';
import DestinationPicker from './DestinationPicker';
import { codeshareInfo, delayStamp } from '../lib/flightLogic';
import { flightStage, boardingAt } from '../lib/stageLogic';
import { mealInfo, mealLabel } from '../lib/mealLogic';
import MEALS from '../data/meals.json';
import { DestinationTeaser, DestinationTab } from './Destination';
import { aircraftName, distanceKm } from '../lib/aviation';
import { AIRPORTS } from '../lib/airports';
import { AIRLINE_STATUS, assessFlight, heDate } from '../lib/airlineStatus';
import { typeInfo as getTypeInfo, seatBlocks, seatSide } from '../lib/aircraftInfo';
import AirlineLogo, { iataFromCallsign } from './AirlineLogo';
import { Sky, skyTheme, ArcPlane, BoardingPass } from './visuals';
import { useT, apiUrl } from './i18n';

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
// בעברית: השם המוכר מהרשימה. באנגלית השרת כבר שולח את שם העיר באנגלית
export const CITY_NAMES = CITY;
const cityOf = (side, tr) => (tr && tr.lang !== 'he' ? side.cityHe || (CITY[side.iata] && tr.has(CITY[side.iata]) ? tr.raw(CITY[side.iata]) : side.iata) : CITY[side.iata] || side.cityHe || side.iata);

// flip: בעברית המטוס פונה שמאלה, בכיוון הקריאה
const PlaneIcon = ({ color = 'currentColor', size = 22, flip = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
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
      <div className="cloud" style={{ insetInlineEnd: 40, top: 118, width: 120, height: 36, opacity: 0.9 }} aria-hidden="true" />
      <div className="cloud" style={{ insetInlineEnd: 80, top: 100, width: 60, height: 44, opacity: 0.9 }} aria-hidden="true" />
      <div className="cloud cloud-far" style={{ insetInlineStart: -30, top: 190, width: 140, height: 34, opacity: 0.6 }} aria-hidden="true" />
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

function statusOf(f, tr) {
  const { departed, landed } = flightState(f);
  const loc = (s) => ({ ...s, text: tr.raw(s.text) });
  if (f.status === 'cancelled' || f.status === 'diverted' || f.status === 'incident') return loc(STATUS[f.status]);
  if (landed) return loc(STATUS.landed);
  if (!departed) return { text: tr('לפני המראה'), tone: 'warn' };
  return loc(STATUS.active);
}

function SearchCard({ flightNo, setFlightNo, date, setDate, onSearch, onCancel, loading }) {
  const tr = useT();
  return (
    <form className="card edit" onSubmit={(e) => { e.preventDefault(); onSearch(); }}>
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>{tr('איזו טיסה לעקוב?')}</h2>
      <div className="field">
        <label htmlFor="flightNo">{tr('מספר טיסה')}</label>
        <input id="flightNo" value={flightNo} onChange={(e) => setFlightNo(e.target.value.toUpperCase())} placeholder={tr('לדוגמה LY315')} autoCapitalize="characters" />
      </div>
      <div className="field">
        <label htmlFor="flightDate">{tr('תאריך')}</label>
        <input id="flightDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-sun" disabled={loading || !flightNo}>{loading ? tr('מחפש…') : tr('חפש טיסה')}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>{tr('ביטול')}</button>}
      </div>
    </form>
  );
}

function InboundCard({ f, inbound, now }) {
  const tr = useT();
  if (!inbound || inbound.error) return null;
  const reg = f.aircraft?.registration;
  const from = f.departure.iata;
  const s = inbound.state;
  let title = '', text = '', tone = null, extra = null;

  if (s === 'silent') {
    title = tr('המטוס לא משדר כרגע');
    text = tr('{reg} לא משדר מיקום. בדרך כלל זה אומר שהוא חונה ומנועיו כבויים, למשל כבר בשדה שממנו תמריא.', { reg });
  } else if (s === 'at_airport') {
    title = tr('המטוס כבר בשדה ✓');
    text = tr('{reg} נמצא ב-{from}. זה סימן טוב להמראה בזמן.', { reg, from });
    tone = 'good';
  } else if (s === 'ground_elsewhere') {
    title = tr('המטוס על הקרקע בשדה אחר');
    text = tr('{reg} נמצא כ-{km} ק״מ מ-{from}. הוא יצטרך לטוס לכאן לפני הטיסה שלך.', { reg, km: inbound.distKm, from });
    tone = 'warn';
  } else if (s === 'inbound') {
    title = tr('המטוס בדרך אליך');
    text = inbound.nowCallsign
      ? tr('{reg} טס עכשיו כ-{callsign}, כ-{km} ק״מ מ-{from}, וצפוי לנחות בעוד כ-{eta}.', { reg, callsign: inbound.nowCallsign, km: inbound.distKm, from, eta: minutesLabel(inbound.etaMin, tr) })
      : tr('{reg} טס עכשיו, כ-{km} ק״מ מ-{from}, וצפוי לנחות בעוד כ-{eta}.', { reg, km: inbound.distKm, from, eta: minutesLabel(inbound.etaMin, tr) });
    const depAt = localToInstant(f.departure.estimated || f.departure.scheduled, f.departure.timezone);
    const readyAt = Date.parse(inbound.checkedAt) + (inbound.etaMin + 45) * 60000;
    const late = depAt ? Math.round((readyAt - depAt) / 60000) : null;
    if (late != null && late > 5) { tone = 'bad'; extra = tr('ההמראה שלך עלולה להתעכב בכ-{time}', { time: minutesLabel(late, tr) }); }
    else if (late != null) { tone = 'good'; extra = tr('יש מספיק זמן להכנה בין הטיסות'); }
  } else if (s === 'flying_elsewhere') {
    title = tr('המטוס טס עכשיו לכיוון אחר');
    text = inbound.nowCallsign
      ? tr('{reg} באוויר כ-{callsign}, כ-{km} ק״מ מ-{from}, ולא בכיוון אליו. ייתכן שזו טיסה קודמת שעוד תחזור, או שחברת התעופה תחליף מטוס.', { reg, callsign: inbound.nowCallsign, km: inbound.distKm, from })
      : tr('{reg} באוויר, כ-{km} ק״מ מ-{from}, ולא בכיוון אליו. ייתכן שזו טיסה קודמת שעוד תחזור, או שחברת התעופה תחליף מטוס.', { reg, km: inbound.distKm, from });
    tone = 'warn';
  } else if (s === 'is_our_flight') {
    return null;
  } else {
    title = inbound.onGround ? tr('המטוס על הקרקע') : tr('המטוס באוויר');
    text = tr('לא הצלחנו לזהות את מיקום שדה {from}, ולכן אין הערכה.', { from });
  }

  return (
    <section className="card">
      <div className="row">
        <h2>{tr('המטוס הגיע?')}</h2>
        {tone && <span className={`badge ${tone}`}>{tone === 'good' ? tr('בסדר') : tone === 'bad' ? tr('עיכוב אפשרי') : tr('לשים לב')}</span>}
      </div>
      <span className="strong" style={{ fontSize: 17 }}>{title}</span>
      <span style={{ fontSize: 14, lineHeight: 1.55 }}>{text}</span>
      {extra && <span className="strong" style={{ fontSize: 14, color: tone === 'bad' ? '#8A2412' : 'var(--good)' }}>{extra}</span>}
      <span className="small muted">{tr('הערכה בלבד, לפי מיקום המטוס בזמן אמת (adsb.lol) וזמן הכנה של כ-45 דק׳ בין טיסות')} · {agoLabel(now - Date.parse(inbound.checkedAt), tr)}</span>
    </section>
  );
}

// רענון קבוע עם האטה: כשהשירות עמוס או נכשל, מחכים יותר זמן בין ניסיונות (עד 2 דקות),
// והמסך ממשיך להציג את הנתון האחרון שהגיע
function usePolling(fn, baseMs, deps) {
  useEffect(() => {
    let stop = false, timer = null, fails = 0;
    const tick = async () => {
      if (stop) return;
      let ok = true;
      if (!document.hidden) { try { ok = (await fn(() => stop)) !== false; } catch { ok = false; } }
      fails = ok ? 0 : Math.min(fails + 1, 4);
      if (!stop) timer = setTimeout(tick, Math.min(baseMs * 2 ** fails, 120000));
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const TLV_COORDS = { lat: 32.0114, lon: 34.8867, label: 'נתב״ג' };
const NO_ID = 'ללא זיהוי';

function NearbyTab({ now }) {
  const tr = useT();
  const [where, setWhere] = useState(null);
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setStatus('denied'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setWhere({ lat: p.coords.latitude, lon: p.coords.longitude, label: tr('המיקום שלך') }); setStatus('ready'); },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [tr]);

  useEffect(() => { locate(); }, [locate]);

  usePolling(async (stopped) => {
    if (!where) return true;
    // מעגלים את המיקום לכ-2 ק״מ כבר בטלפון: המיקום המדויק לא יוצא מהמכשיר
    const lat = (Math.round(where.lat * 50) / 50).toFixed(2), lon = (Math.round(where.lon * 50) / 50).toFixed(2);
    try {
      const res = await fetch(apiUrl(tr, `/api/nearby?lat=${lat}&lon=${lon}`));
      const body = await res.json();
      if (stopped()) return true;
      if (!res.ok) { if (!data) setError(body.error || tr('משהו השתבש')); return false; }
      setData(body); setError('');
      return true;
    } catch { if (!stopped() && !data) setError(tr('אין חיבור לאינטרנט')); return false; }
  }, 30000, [where]);

  const planes = data?.planes || [];
  const flying = planes.filter((p) => !p.onGround);
  const ground = planes.filter((p) => p.onGround);

  return (
    <>
      <header className="hero short" style={{ background: skyTheme('Asia/Jerusalem', Date.now()).bg, color: skyTheme('Asia/Jerusalem', Date.now()).ink }}>
        <Sky theme={skyTheme('Asia/Jerusalem', Date.now())} />
        <span className="pill">{where ? tr.raw(where.label) : tr('מאתר מיקום…')} ✦</span>
        <h1>{tr('מה טס מעליי?')}</h1>
        <p>{data ? tr('{n} מטוסים באוויר ברדיוס {km} ק״מ', { n: flying.length, km: data.radiusKm }) : tr('כל המטוסים סביבך, בזמן אמת')}</p>
      </header>
      <div className="content flat">
        {status === 'denied' && !where && (
          <section className="card cream">
            <span className="strong">{tr('אין גישה למיקום')}</span>
            <span style={{ fontSize: 14 }}>{tr('אפשר לאשר גישה למיקום בדפדפן, או לראות מה טס עכשיו ליד נתב״ג.')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-sun" onClick={() => { setWhere(TLV_COORDS); setStatus('ready'); }}>{tr('הצג ליד נתב״ג')}</button>
              <button type="button" className="btn-ghost" onClick={locate}>{tr('נסה שוב')}</button>
            </div>
          </section>
        )}
        {status === 'locating' && <section className="card"><PlaneLoader text={tr('מאתר את המיקום שלך…')} /></section>}
        {where && !data && !error && <section className="card"><PlaneLoader text={tr('מחפש מטוסים סביבך…')} /></section>}
        {error && <div className="error" role="alert">{error}</div>}
        {data && planes.length === 0 && <div className="card">{tr('אין כרגע מטוסים משדרים באזור.')}</div>}
        {data && where && <NearbyMap center={{ lat: Math.round(where.lat * 50) / 50, lon: Math.round(where.lon * 50) / 50 }} radiusKm={data.radiusKm} planes={planes} />}

        {flying.map((p) => (
          <section key={p.id} className="card" style={{ gap: 6 }}>
            <div className="row">
              <span style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>{iataFromCallsign(p.callsign) && <AirlineLogo iata={iataFromCallsign(p.callsign)} name={p.airline} size={26} />}{p.callsign || p.registration || tr(NO_ID)}{p.airline ? <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> · {p.airline}</span> : null}</span>
              <span className="badge good">{tr('{km} ק״מ', { km: p.distKm })}{p.fromYou ? ` · ${p.fromYou}` : ''}</span>
            </div>
            {p.route && <span className="strong" style={{ fontSize: 16 }}>{p.route.from.city} {ARROW[tr.dir]} {p.route.to.city} <bdi dir="ltr" className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{p.route.from.code} → {p.route.to.code}</bdi></span>}
            <span style={{ fontSize: 14 }}>{p.type ? aircraftName(p.type, tr) : tr('דגם לא ידוע')}{p.registration && p.callsign ? ` · ${p.registration}` : ''}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {tr('{ft} רגל', { ft: p.altFt.toLocaleString('en-US') })} · {tr('{n} קמ״ש', { n: p.speedKmh })}
              {p.verticalFpm > 300 ? ` · ${tr('מטפס')}` : p.verticalFpm < -300 ? ` · ${tr('יורד')}` : ''}
              {p.heading ? ` · ${tr('טס ל{dir}', { dir: p.heading })}` : ''}
            </span>
          </section>
        ))}

        {ground.length > 0 && (
          <section className="card">
            <h2>{tr('על הקרקע ({n})', { n: ground.length })}</h2>
            {ground.map((p) => (
              <div key={p.id} className="row">
                <span>{p.callsign || p.registration || tr(NO_ID)}{p.airline ? ` · ${p.airline}` : ''}{p.route ? ` · ${p.route.from.city} ${ARROW[tr.dir]} ${p.route.to.city}` : ''}</span>
                <span className="muted">{p.type ? aircraftName(p.type, tr) : ''}</span>
              </div>
            ))}
          </section>
        )}

        {data && <p className="small muted" style={{ margin: 0 }}>{tr('נתונים בזמן אמת מרשת ADS-B (adsb.lol), מתעדכנים כל 30 שניות')} · {agoLabel(now - Date.parse(data.at), tr)}. {tr('מטוסים צבאיים או פרטיים לא תמיד משדרים זיהוי.')}</p>}
        <p className="small muted" style={{ margin: 0 }}>{tr('פרטיות: המיקום שלך מעוגל לכ-2 ק״מ עוד בטלפון, נשלח רק כדי למצוא מטוסים סביבך, ולא נשמר אצלנו עם שום פרט מזהה.')}</p>
      </div>
    </>
  );
}

function AirlineAlert({ f, goStatus }) {
  const tr = useT();
  const r = assessFlight(f, tr);
  if (!r || r.level === 'ok') return null;
  const bad = r.level === 'bad';
  return (
    <section className="card" style={{ background: bad ? '#FFD9D2' : 'var(--cream)', gap: 6 }} role="alert">
      <span className="strong" style={{ fontSize: 17, color: bad ? '#8A2412' : '#5C4A12' }}>{r.title}</span>
      {r.text && <span style={{ fontSize: 14, lineHeight: 1.55 }}>{r.text}</span>}
      <span style={{ fontSize: 14 }}>{tr('כדאי לבדוק מול חברת התעופה אם הטיסה שלך מתקיימת, ומה מגיע לך אם היא בוטלה.')}</span>
      <button type="button" className="btn-ghost" onClick={goStatus} style={{ alignSelf: 'flex-start' }}>{tr('מי עוד טס?')} {GO[tr.dir]}</button>
    </section>
  );
}

function StatusTab() {
  const tr = useT();
  const [q, setQ] = useState('');
  const list = AIRLINE_STATUS.airlines.filter((a, i, arr) => arr.findIndex((b) => b.name === a.name) === i)
    .map((a) => ({ ...a, name: tr.raw(a.name), note: a.note && tr.raw(a.note), routes: (a.routes || []).map((r) => ({ ...r, note: r.note && tr.raw(r.note) })) }));
  const match = (a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.iata.includes(q.toUpperCase()) || (a.icao || '').includes(q.toUpperCase());
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
        <span className="pill">{tr('עודכן {date}', { date: heDate(AIRLINE_STATUS.updatedAt, tr) })} ✦</span>
        <h1>{tr('מי טס עכשיו?')}</h1>
        <p>{tr('{a} חברות טסות · {b} חוזרות בקרוב · {c} לא טסות', { a: flying.length, b: returning.length, c: suspended.length })}</p>
      </header>
      <div className="content flat">
        <div className="field">
          <label htmlFor="airlineSearch">{tr('חיפוש חברת תעופה')}</label>
          <input id="airlineSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('לדוגמה: וויז או LH')} />
        </div>

        {suspended.length > 0 && (
          <section className="card" style={{ background: '#FFE9E4' }}>
            <h2>{tr('לא טסות כרגע לישראל')}</h2>
            {suspended.map((a) => <Row key={a.iata} a={a} extra={a.until ? tr('מושהה עד {date}', { date: heDate(a.until, tr) }) : tr('מושהה עד הודעה חדשה')} />)}
          </section>
        )}

        {returning.length > 0 && (
          <section className="card cream">
            <h2>{tr('חוזרות בקרוב')}</h2>
            {returning.map((a) => <Row key={a.iata} a={a} extra={a.date ? tr('חוזרת ב-{date}', { date: heDate(a.date, tr) }) : tr('מועד החזרה טרם נקבע סופית')} />)}
          </section>
        )}

        {routeIssues.length > 0 && (
          <section className="card cream">
            <h2>{tr('קווים מושהים')}</h2>
            {routeIssues.flatMap((a) => (a.routes || []).filter((r) => r.status === 'suspended').map((r) => (
              <Row key={a.iata + r.iata} a={{ ...a, note: r.note }} extra={`${r.iata}${r.until ? ` · ${tr('עד {date}', { date: heDate(r.until, tr) })}` : ''}`} />
            )))}
          </section>
        )}

        <section className="card mint">
          <h2>{tr('טסות לישראל')}</h2>
          {flying.map((a) => <Row key={a.iata} a={a} />)}
        </section>

        <section className="card">
          <h2>{tr('מקורות')}</h2>
          {AIRLINE_STATUS.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--coral-ink)' }}>{tr.raw(s.title)} ({heDate(s.date, tr)})</a>
          ))}
          <span className="small muted">{tr('המצב משתנה מהר. לפני הטיסה תמיד כדאי לבדוק גם באתר של חברת התעופה.')}</span>
        </section>
      </div>
    </>
  );
}

function PlaneLoader({ text, small = false }) {
  return (
    <div className={`loader ${small ? 'small' : ''}`} role="status" aria-live="polite">
      <div className="orbit" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF7A59" stroke="#fff" strokeWidth="1" style={{ transform: 'rotate(90deg)' }}>
          <path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" />
        </svg>
      </div>
      {text && <span className="muted" style={{ fontSize: small ? 13 : 15 }}>{text}</span>}
    </div>
  );
}

// חץ "קדימה" ו"מסלול": בעברית שמאלה, באנגלית ימינה
const GO = { rtl: '←', ltr: '→' };
const BACK = { rtl: '→', ltr: '←' };
const ARROW = GO;

// שעה בשעון ישראל, לפי השפה
const clockOf = (ms, tr) => new Date(ms).toLocaleTimeString(tr.locale, { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });

const BOARD_TONE = (st) => (/CANCEL/.test(st) ? 'bad' : st === 'DELAYED' ? 'warn' : 'good');

function BoardTab({ now, onOpen }) {
  const tr = useT();
  const [dir, setDir] = useState('D');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    let stop = false;
    setData(null); setError('');
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(apiUrl(tr, `/api/board?dir=${dir}&q=${encodeURIComponent(query)}`));
        const body = await res.json();
        if (stop) return;
        if (!res.ok) setError(body.error || tr('משהו השתבש')); else { setData(body); setError(''); }
      } catch { if (!stop) setError(tr('אין חיבור לאינטרנט')); }
    };
    load();
    const id = setInterval(load, 120000);
    return () => { stop = true; clearInterval(id); };
  }, [dir, query, tr]);

  const theme = skyTheme('Asia/Jerusalem', now);
  const rows = data?.rows || [];
  return (
    <>
      <header className="hero short" style={{ background: theme.bg, color: theme.ink }}>
        <Sky theme={theme} flyer />
        <span className="pill">{tr('לוח נתב״ג חי')} ✦</span>
        <h1>{dir === 'D' ? tr('המראות') : tr('נחיתות')}</h1>
        <p style={{ fontSize: 14, opacity: 0.9 }}>{dir === 'D' ? tr('מה ממריא מנתב״ג') : tr('מה נוחת בנתב״ג')} · {query ? tr('שלושת הימים הקרובים') : tr('שעתיים אחורה ו-12 שעות קדימה')}</p>
      </header>
      <div className="content flat">
        <div role="tablist" aria-label={tr('המראות או נחיתות')} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {[['D', tr('המראות')], ['A', tr('נחיתות')]].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={dir === k} onClick={() => setDir(k)}
              style={{ height: 46, borderRadius: 14, border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                background: dir === k ? 'var(--ink)' : '#fff', color: dir === k ? '#fff' : 'var(--ink)' }}>{label}</button>
          ))}
        </div>
        {dir === 'D' && !query && <CrowdForecast now={now} />}
        <div className="field">
          <label htmlFor="boardSearch">{tr('חיפוש לפי עיר, מדינה, חברה או מספר טיסה')}</label>
          <input id="boardSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('לדוגמה: אתונה, וויז, LY315')} />
        </div>

        {error && <div className="error" role="alert">{error}</div>}
        {!data && !error && <section className="card"><PlaneLoader text={tr('טוען את הלוח…')} /></section>}
        {data && rows.length === 0 && <div className="card">{query ? tr('לא נמצאו טיסות עבור "{q}".', { q: query }) : tr('לא נמצאו טיסות.')}</div>}

        {rows.length > 0 && (
          <section className="card" style={{ padding: 8, gap: 0 }}>
            {rows.map((r) => {
              const late = r.ptol !== r.stol;
              const past = r.t < now;
              return (
                <button key={`${r.op}${r.fn}${r.stol}`} type="button" onClick={() => onOpen(`${r.op}${r.no ?? r.fn}`, r.stol.slice(0, 10))}
                  style={{ display: 'grid', gridTemplateColumns: '58px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 8px', border: 'none',
                    borderBottom: '1px solid #EAF1F7', textAlign: 'start', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer', background: past ? '#F1F5F9' : 'none' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 800, textDecoration: late ? 'line-through' : 'none', color: late ? 'var(--muted)' : 'var(--ink)', fontSize: late ? 13 : 17 }}>{r.stol.slice(11, 16)}</span>
                    {late && <span style={{ fontSize: 17, fontWeight: 800, color: r.ptol > r.stol ? 'var(--coral-ink)' : 'var(--good)' }}>{r.ptol.slice(11, 16)}</span>}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <AirlineLogo iata={r.op} name={r.opName} size={24} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span className="strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.city}</span>
                      <span className="muted small">{r.op}{r.no ?? r.fn} · {r.opName}{r.term ? ` · ${tr('טרמינל {n}', { n: r.term })}` : ''}</span>
                    </span>
                  </span>
                  <span className={`badge ${BOARD_TONE(r.st)}`} style={{ fontSize: 12 }}>{r.stHe || r.st}</span>
                </button>
              );
            })}
          </section>
        )}
        {data && <p className="small muted" style={{ margin: 0 }}>{tr('נתונים רשמיים מלוח נתב״ג של רשות שדות התעופה, מתעדכנים כל כמה דקות')} · {agoLabel(now - Date.parse(data.at), tr)}. {tr('לחיצה על טיסה פותחת אותה.')}</p>}
      </div>
    </>
  );
}

const WA_PATH = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z';

// שיתוף בוואטסאפ: כפתור קטן ליד "שנה טיסה", במקום כרטיס שלם
// התאריך שמוביל בדיוק לאותה טיסה, בקישור משותף ובריענון. בטיסה שנוחתת בישראל זה תאריך הנחיתה כאן,
// כי לפי תאריך ההמראה בחו״ל השרת מעדיף את הטיסה שנוחתת באותו יום (UA84 של אתמול במקום של מחר)
const lookupDate = (f) => (f.direction === 'arrival' && f.boardDate ? f.boardDate : f.date);

function ShareButton({ f }) {
  const tr = useT();
  const url = typeof window !== 'undefined' ? `${window.location.origin}${tr.href('/')}?f=${encodeURIComponent(f.flight)}&d=${encodeURIComponent(lookupDate(f))}` : '';
  const dest = f.arrival?.iata ? cityOf(f.arrival, tr) : null;
  const text = dest
    ? tr('עקבו אחרי הטיסה שלי {flight} ל{dest} בזמן אמת ✈️', { flight: f.flight, dest })
    : tr('עקבו אחרי הטיסה שלי {flight} בזמן אמת ✈️', { flight: f.flight });
  return (
    <a href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label={tr('שתף את הטיסה בוואטסאפ')} className="wa-btn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d={WA_PATH} /></svg>
      <span>{tr('שתף')}</span>
    </a>
  );
}

// ---------- כרטיסי "ראש המסך" לפי שלב ----------
function BoardingLead({ f, depAt }) {
  const tr = useT();
  const b = boardingAt(depAt);
  return (
    <section className="card big" style={{ gap: 8 }}>
      <span className="small muted">{tr('כבר בשדה?')}</span>
      <span style={{ fontSize: 26, fontWeight: 800 }}>{tr('עלייה למטוס בערך ב-{time}', { time: b ? clockOf(b, tr) : '—' })}</span>
      <span style={{ fontSize: 15, lineHeight: 1.55 }}>
        {f.departure.gate ? <b>{tr('שער {gate}', { gate: f.departure.gate })}</b> : tr('השער מופיע על המסכים בטרמינל, בדרך כלל כשעה לפני ההמראה.')}
        {f.departure.checkin ? <> · {f.departure.checkinZone ? tr('דלפקים {desks}, אזור {zone}', { desks: f.departure.checkin, zone: f.departure.checkinZone }) : tr('דלפקים {desks}', { desks: f.departure.checkin })}</> : null}
      </span>
      <span className="small muted">{tr('שעה משוערת, כ-40 דק׳ לפני ההמראה. השעה הקובעת היא זו שבכרטיס שלך.')}</span>
    </section>
  );
}

function AirLead({ f, left, arrivingTLV, goLive }) {
  const tr = useT();
  const t = hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled);
  return (
    <section className="card big" style={{ gap: 8 }}>
      <span className="small muted">{arrivingTLV ? tr('בדרך לישראל') : tr('בטיסה')}</span>
      <span style={{ fontSize: 26, fontWeight: 800 }}>{tr('נוחתים ב-{time}', { time: t })}</span>
      {left > 0 && <span style={{ fontSize: 16 }}>{tr('עוד {time}', { time: <b>{minutesLabel(left, tr)}</b> })}{f.arrival.estimatedByUs ? ` ${tr('(הערכה לפי המרחק)')}` : ''}</span>}
      <button type="button" className="btn-sun" onClick={goLive} style={{ flex: 'none' }}>{tr('איפה המטוס עכשיו')} {GO[tr.dir]}</button>
    </section>
  );
}

function LandedLead({ f, now, waiting }) {
  const tr = useT();
  const at = localToInstant(f.arrival.actual || f.arrival.estimated, f.arrival.timezone || 'Asia/Jerusalem');
  const t = hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled);
  const fresh = at && now - at < 60 * 60000;
  const outAt = at ? at + 35 * 60000 : null;
  return (
    <section className="card big" style={{ gap: 8 }}>
      <span style={{ fontSize: 26, fontWeight: 800 }}>{waiting ? tr('נחתו ב-{time} ✓', { time: t }) : tr('נחתתם ב-{time} ✓', { time: t })}</span>
      {waiting && fresh && <span style={{ fontSize: 15, lineHeight: 1.55 }}>{tr('בדרך כלל הנוסעים יוצאים מהטרמינל 30–40 דקות אחרי הנחיתה, אחרי ביקורת הגבולות והמזוודות.')} {now < outAt ? tr('כלומר בערך ב-{time}.', { time: <b>{clockOf(outAt, tr)}</b> }) : tr('כלומר הם אמורים לצאת בדקות האלה.')}</span>}
      {!waiting && <span style={{ fontSize: 15, lineHeight: 1.55 }}>{tr('איך מגיעים מהשדה לעיר? בכרטיס הטיפים שלמטה.')}</span>}
    </section>
  );
}

// "עוד פרטים": כל מה שלא חשוב ברגע הזה, מקופל
function MoreDetails({ children }) {
  const tr = useT();
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (!items.length) return null;
  return (
    <details className="more">
      <summary className="card more-sum"><span className="strong">{tr('עוד פרטים על הטיסה')}</span><span className="muted small">{tr('זמנים, המטוס ועוד')}</span></summary>
      <div className="more-body">{items.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</div>
    </details>
  );
}

// "יש אוכל בטיסה?": לפי החברה שמפעילה בפועל (בשיתוף קוד זו לא בהכרח החברה שבכרטיס)
function MealCard({ f }) {
  const tr = useT();
  const cs = codeshareInfo(f);
  const op = cs ? cs.op : { iata: f.airlineIata, airline: f.airline };
  const dep = localToInstant(f.departure.scheduled, f.departure.timezone || 'Asia/Jerusalem');
  const arr = localToInstant(f.arrival.scheduled || f.arrival.estimated, f.arrival.timezone);
  const dur = dep && arr && arr > dep ? Math.round((arr - dep) / 60000) : null;
  const m = mealInfo(op.iata, dur, tr);
  if (!m) return null;
  const tone = m.kind === 'included' ? 'good' : m.kind === 'paid' ? 'warn' : '';
  return (
    <section className="card" style={{ gap: 8 }}>
      <div className="row">
        <h2>{tr('🍽️ יש אוכל בטיסה?')}</h2>
        <span className={`badge ${tone}`}>{mealLabel(m.kind, tr)}{m.known ? '' : ` · ${tr('בדרך כלל')}`}</span>
      </div>
      <span style={{ fontSize: 14, lineHeight: 1.55 }}>{cs && !cs.op.own ? `${tr('הטיסה מופעלת על ידי {airline}, ולכן המדיניות שלה קובעת.', { airline: op.airline || op.iata })} ` : ''}{m.text}</span>
      <span className="small muted">{tr('צריכים ארוחה כשרה, צמחונית או ללא גלוטן? ברוב החברות מזמינים מראש באתר או באפליקציה, בדרך כלל עד 24–48 שעות לפני הטיסה.')} {tr.raw(MEALS.note)}</span>
    </section>
  );
}

function CodeshareCard({ f }) {
  const tr = useT();
  const c = codeshareInfo(f);
  if (!c) return null;
  const mine = c.op.own;
  const names = c.others.map((x) => `${x.airline || x.iata} (${x.flight})`).join(', ');
  return (
    <section className="card" style={{ gap: 8, border: '2px solid #CFE6F7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AirlineLogo iata={c.op.iata} name={c.op.airline} size={30} />
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="small muted">{tr('טיסה משותפת')}{c.certain ? '' : ` · ${tr('ככל הנראה')}`}</span>
          <span className="strong" style={{ fontSize: 16 }}>
            {mine ? tr('{airline} מפעילה את הטיסה', { airline: c.op.airline }) : tr('בפועל טסים עם {airline} ({flight})', { airline: c.op.airline || c.op.iata, flight: c.op.flight })}
          </span>
        </span>
      </div>
      <span style={{ fontSize: 14, lineHeight: 1.55 }}>
        {mine
          ? tr('אותה טיסה נמכרת גם בתור {names}. אם בכרטיס שלך כתוב מספר אחר, זו אותה טיסה ואותו מטוס.', { names })
          : tr('הכרטיס שלך הוא של {airline} ({flight}), אבל המטוס, הצוות והדלפקים בשדה הם של {op}. בלוחות בטרמינל הטיסה יכולה להופיע תחת {opFlight}.', { airline: f.airline, flight: f.flight, op: c.op.airline || c.op.iata, opFlight: c.op.flight })}
      </span>
      <span className="small muted">{tr('תנאי כבודה ושינויים בכרטיס נקבעים בדרך כלל לפי החברה שממנה קניתם. כדאי לבדוק מולה.')}</span>
    </section>
  );
}

function FlightsTab({ f, now, editing, setEditing, search, error, changes, clearChanges, goAircraft, goDest, inbound, goStatus, goLive, loading, liveLoading }) {
  const tr = useT();
  const hasFlight = !!f;
  const st = hasFlight ? statusOf(f, tr) : null;
  const fs = hasFlight ? flightState(f) : null;
  const stTone = hasFlight && f.statusEn ? (/CANCEL/.test(f.statusEn) ? 'bad' : f.statusEn === 'DELAYED' ? 'warn' : 'good') : st?.tone;
  // עיכוב או ביטול: החותמת האדומה מחליפה את תגית הסטטוס, גם כשהלוח עדיין כותב "בזמן"
  const stamp = hasFlight && !f.liveOnly ? delayStamp(f, tr) : null;
  // בלי "כ-" לפני השעות: התווית ליד השעה כבר אומרת שזו הערכה
  const approx = () => '';
  const t = hasFlight ? times(f) : null;
  const left = t?.arrAt ? Math.ceil((t.arrAt - now) / 60000) : null;
  const toDep = t?.depAt ? Math.ceil((t.depAt - now) / 60000) : null;
  const early = t?.arrAt && t?.arrSched ? Math.round((t.arrSched - t.arrAt) / 60000) : 0;

  let pill = tr('מעקב טיסה');
  if (hasFlight) {
    if (f.status === 'cancelled' || /CANCEL/.test(f.statusEn || '')) pill = tr('בוטלה');
    else if (fs.landed) pill = tr('נחתה');
    else if (fs.departed) pill = tr('בטיסה עכשיו');
    else if (toDep <= 0) pill = tr('ממריאה בקרוב');
    else if (toDep > 0) pill = toDep > 1440 ? tr('עוד {n} ימים', { n: Math.round(toDep / 1440) }) : tr('עוד {time}', { time: minutesLabel(toDep, tr) });
  }
  const title = hasFlight
    ? (f.liveOnly ? (f.live?.isGround ? tr('{callsign} על הקרקע', { callsign: f.callsign }) : tr('{callsign} בשמיים!', { callsign: f.callsign })) : fs.landed ? tr('נחתת!') : tr('טסים ל{city}!', { city: cityOf(f.arrival, tr) }))
    : tr('לאן טסים? ✈️');

  const [seat, setSeat] = useState('');
  useEffect(() => { try { setSeat(localStorage.getItem('kanaf:seat') || ''); } catch {} }, []);
  const typeInfo = hasFlight && f.aircraft?.type ? getTypeInfo(f.aircraft.type, tr) : null;
  let boarding = null;
  if (hasFlight) {
    const dep = hhmm(f.departure.estimated || f.departure.scheduled);
    if (dep) {
      const mins = (Number(dep.slice(0, 2)) * 60 + Number(dep.slice(3, 5)) - 40 + 1440) % 1440;
      boarding = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }
  }
  // ---------- סידור המסך לפי שלב הטיסה ----------
  let stageView = null;
  if (hasFlight && !f.liveOnly) {
    const cs = codeshareInfo(f);
    // שיתוף קוד: מי שקנה כרטיס של חברה אחת יכול לטוס בפועל בחברה אחרת. זה חשוב, אז מודגש
    const opName = cs ? (cs.op.airline || cs.op.iata) : null;
    const csLine = cs ? (cs.op.own
      ? tr('טיסה משותפת: מי שקנה כרטיס {flights} טס בטיסה הזו, ב{airline}.', { flights: <>{cs.others.map((x, i) => <Fragment key={x.flight}>{i ? ` ${tr('או')} ` : ''}<bdi><b>{x.flight}</b></bdi></Fragment>)}</>, airline: <b>{opName}</b> })
      : tr('טיסה משותפת: הכרטיס של {ticket}, אבל בפועל טסים ב{airline} ({flight}). הצ׳ק-אין, הדלפקים והמטוס של {op}.', { ticket: f.airline || f.flight, airline: <b>{opName}</b>, flight: <bdi>{cs.op.flight}</bdi>, op: opName })) : null;
    const cancelled = f.status === 'cancelled' || /CANCEL/.test(f.statusEn || '');
    const arrivingTLV = f.arrival.iata === 'TLV';
    const leavePick = (
      <>
              {f.departure.iata === 'TLV' && !fs.departed && f.status !== 'cancelled' && !/CANCEL/.test(f.statusEn || '') && <LeaveHomeCard f={f} now={now} />}
              {f.arrival.iata === 'TLV' && f.status !== 'cancelled' && !/CANCEL/.test(f.statusEn || '') && <PickupCard f={f} now={now} />}
      </>
    );
    const gateNote = (
      <>
              {f.source !== 'iaa' && !f.departure.gate && f.status === 'scheduled' && (
                <section className="card cream note">
                  <div className="icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E2A47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="strong">{tr('השער עוד לא פורסם')}</span>
                    <span style={{ fontSize: 14, color: '#5C4A12', lineHeight: 1.5 }}>{tr('הוא נקבע בדרך כלל כמה שעות לפני ההמראה.')}</span>
                  </div>
                </section>
              )}
      </>
    );
    const planeCard = (
      <>
              {(() => {
                // רק כשהמטוס זוהה הכרטיס לחיץ ומוביל למסך המטוס
                const known = !!f.aircraft?.type;
                const Tag = known ? 'button' : 'section';
                return (
                <Tag {...(known ? { type: 'button', onClick: goAircraft } : {})} className="card peach" style={{ border: 'none', textAlign: 'start', cursor: known ? 'pointer' : 'default', flexDirection: 'row', alignItems: 'center', gap: 14, color: 'inherit' }}>
                  <div className="plane-dot" style={{ width: 54, height: 54, borderRadius: 18 }}><span style={{ color: '#fff', display: 'flex' }}><TopIcon /></span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 13, color: '#6B3A2A' }}>{f.aircraft?.type ? tr('תטוס ב-') : tr('המטוס של הטיסה')}</span>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>{f.aircraft?.type ? `${aircraftName(f.aircraft.type, tr)}${f.aircraft.registration ? ` · ${f.aircraft.registration}` : ''}` : (fs.departed ? tr('לא הצלחנו לזהות את המטוס') : tr('נזהה את המטוס בקרוב'))}</span>
                    <span style={{ fontSize: 14, fontWeight: f.aircraft?.type ? 700 : 400, color: f.aircraft?.type ? 'var(--coral-ink)' : '#6B3A2A', lineHeight: 1.5 }}>{f.aircraft?.type ? `${tr('הכר את המטוס שלך')} ${GO[tr.dir]}` : fs.departed ? tr('המטוס לא משדר זיהוי שאנחנו קולטים כרגע') : tr('בדרך כלל כחצי שעה עד שעה לפני ההמראה, כשהמטוס מתחיל לשדר. אז יופיעו דגם, תמונה ותרשים מושבים')}</span>
                    {!f.aircraft?.type && liveLoading && <PlaneLoader small text={tr('מחפש את המטוס…')} />}
                  </div>
                </Tag>
                );
              })()}
      </>
    );
    const inboundCard = (
      <>
              {!fs.departed && f.aircraft?.registration && (inbound
                ? <InboundCard f={f} inbound={inbound} now={now} />
                : <section className="card"><h2>{tr('המטוס הגיע?')}</h2><PlaneLoader small text={tr('בודק איפה המטוס עכשיו…')} /></section>)}
      </>
    );
    const timesCard = (
      <>
              <section className="card">
                <h2>{tr('הזמנים')}</h2>
                <div className="row"><span className="muted">{f.departure.estimatedByUs ? tr('המראה משוערת (לפי המרחק, שעון מקומי)') : tr('המראה מתוכננת')}</span><span className="strong">{approx(f.departure)}{hhmm(f.departure.estimated || f.departure.scheduled)}</span></div>
                {f.source === 'iaa' && f.direction === 'departure' && !f.departure.actual && f.departure.delay > 0 && (
                  <div className="row"><span className="muted">{tr('שעה מעודכנת')}</span><span className="strong" style={{ color: 'var(--coral-ink)' }}>{hhmm(f.departure.estimated)} · {tr('איחור {n} דק׳', { n: f.departure.delay })}</span></div>
                )}
                {f.departure.actual && (
                  <div className="row"><span className="muted">{tr('המראה בפועל')}</span><span className="strong" style={{ color: f.departure.delay > 0 ? 'var(--coral-ink)' : 'var(--good)' }}>{hhmm(f.departure.actual)}{f.departure.delay > 0 ? ` · ${tr('איחור {n} דק׳', { n: f.departure.delay })}` : ''}</span></div>
                )}
                {!f.arrival.estimatedByUs && <div className="row"><span className="muted">{tr('נחיתה מתוכננת (שעון מקומי)')}</span><span className="strong">{hhmm(f.arrival.scheduled)}</span></div>}
                <div className="row"><span className="muted">{f.arrival.actual ? tr('נחיתה בפועל') : f.arrival.estimatedByUs ? tr('נחיתה משוערת (לפי המרחק, שעון מקומי)') : tr('נחיתה צפויה')}</span>
                  <span className="strong" style={{ color: 'var(--good)' }}>
                    {approx(f.arrival)}{hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled)}
                    {!f.arrival.actual && left > 0 ? ` · ${tr('עוד {time}', { time: minutesLabel(left, tr) })}` : ''}
                    {early > 0 && !f.arrival.estimatedByUs ? ` · ${tr('{n} דק׳ מוקדם', { n: early })}` : ''}
                  </span>
                </div>
                {f.arrival.terminal && <div className="row"><span className="muted">{tr('טרמינל נחיתה')}</span><span className="strong">{f.arrival.terminal}</span></div>}
                <span className="small muted">{f.source === 'iaa' ? tr('נתונים רשמיים מלוח נתב״ג של רשות שדות התעופה') : tr('נתונים אמיתיים מ-Aviationstack')} · {agoLabel(now - Date.parse(f.fetchedAt), tr)}</span>
              </section>
      </>
    );

    const pass = (
      <>
              <BoardingPass
                stamp={stamp}
                seed={`${f.flight}${f.date}`}
                label={tr('כרטיס טיסה {flight} מ-{from} ל-{to}', { flight: f.flight, from: f.departure.iata, to: f.arrival.iata })}
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
                      {!stamp && <span className={`badge ${stTone}`}>{f.statusHe || st.text}</span>}
                    </div>
                    <div className="route">
                      <div className="end">
                        <span className="code">{f.departure.iata}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{cityOf(f.departure, tr)}</span>
                        <span className="strong" style={{ fontSize: 15 }}>{f.departure.actual ? `${tr('המריאה')} ` : ''}{approx(f.departure)}{hhmm(f.departure.actual || f.departure.estimated || f.departure.scheduled)}</span>
                      </div>
                      <div className="mid" aria-hidden="true">
                        <div className="dots" /><div className="plane-dot"><PlaneIcon color="#fff" flip={tr.dir === 'rtl'} /></div><div className="dots" />
                      </div>
                      <div className="end left">
                        <span className="code">{f.arrival.iata}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{cityOf(f.arrival, tr)}</span>
                        <span className="strong" style={{ fontSize: 15 }}>{f.arrival.actual ? `${tr('נחתה')} ` : ''}{approx(f.arrival)}{hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled)}</span>
                      </div>
                    </div>
                    <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                      <div className="tile"><span className="label">{tr('טרמינל')}</span><span className="value">{f.departure.terminal || f.arrival.terminal || '—'}</span></div>
                      <div className="tile"><span className="label">{tr('שער')}</span>{f.departure.gate ? <span className="value">{f.departure.gate}</span> : (fs.departed || f.source === 'iaa') ? <span className="value" style={{ color: '#8AA0B8' }}>—</span> : <span className="soon">{tr('בקרוב')}</span>}</div>
                      <div className="tile"><span className="label">{tr('מושב')}</span><span className="value" style={{ color: seat ? 'var(--ink)' : '#8AA0B8' }}>{seat || '—'}</span></div>
                      <div className="tile"><span className="label">{tr('עלייה*')}</span><span className="value">{(!f.departure.estimatedByUs && boarding) || '—'}</span></div>
                    </div>
                    {f.departure.checkin && <span className="strong" style={{ fontSize: 14, marginTop: -6 }}>{tr('דלפקי צ׳ק-אין: {desks}', { desks: f.departure.checkin })}{f.departure.checkinZone ? ` · ${tr('אזור {zone}', { zone: f.departure.checkinZone })}` : ''}</span>}
                    {csLine && <span className="cs-callout">✈️ {csLine}</span>}
                    <span className="small muted" style={{ marginTop: -8 }}>{tr('* שעת עלייה משוערת, כ-40 דק׳ לפני ההמראה. השעה הקובעת היא זו שבכרטיס שלך.')}{(f.departure.estimatedByUs || f.arrival.estimatedByUs) ? ` ${tr('שעת הנחיתה ביעד היא הערכה שלנו לפי המרחק.')}` : ''}</span>
                  </>
                }
                back={
                  <>
                    <div className="row">
                      <span className="strong" style={{ fontSize: 17 }}>{tr('פרטי הטיסה')}</span>
                      <AirlineLogo iata={airIata(f)} name={f.airline} size={26} />
                    </div>
                    {(() => {
                      const depT = hhmm(f.departure.actual || f.departure.estimated || f.departure.scheduled);
                      const arrT = hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled);
                      const d0 = localToInstant(f.departure.actual || f.departure.estimated || f.departure.scheduled, f.departure.timezone || 'Asia/Jerusalem');
                      const d1 = localToInstant(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled, f.arrival.timezone || 'Asia/Jerusalem');
                      const dur = d0 && d1 && d1 > d0 ? Math.round((d1 - d0) / 60000) : null;
                      const a = AIRPORTS[f.departure.iata], b = AIRPORTS[f.arrival.iata];
                      const km = a && b ? Math.round(distanceKm(a[0], a[1], b[0], b[1]) / 10) * 10 : null;
                      return (
                        <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                          <div className="tile"><span className="label">{f.departure.actual ? tr('המריאה') : tr('המראה')}{f.departure.estimatedByUs ? ` ${tr('(הערכה)')}` : ''}</span><span className="value" style={{ fontSize: 19 }}>{depT || '—'}</span></div>
                          <div className="tile"><span className="label">{f.arrival.actual ? tr('נחתה') : tr('נחיתה')}{f.arrival.estimatedByUs ? ` ${tr('(הערכה)')}` : ''}</span><span className="value" style={{ fontSize: 19 }}>{arrT || '—'}</span></div>
                          {dur ? <div className="tile"><span className="label">{tr('משך הטיסה')}</span><span className="value" style={{ fontSize: 19 }}>{minutesLabel(dur, tr)}</span></div> : null}
                          {km ? <div className="tile"><span className="label">{tr('מרחק')}</span><span className="value" style={{ fontSize: 19 }}>{tr('{km} ק״מ', { km: km.toLocaleString(tr.locale) })}</span></div> : null}
                        </div>
                      );
                    })()}
                    <span className="small muted" style={{ marginTop: -4 }}>{tr('השעות בשעון המקומי של כל שדה.')}</span>
                    <div className="row" style={{ marginTop: 4 }}>
                      <span className="strong">{tr('המטוס')}</span>
                      <span style={{ fontWeight: 800 }}>{f.aircraft?.type ? aircraftName(f.aircraft.type, tr) : f.aircraft?.registration ? f.aircraft.registration : tr('יזוהה כשהמטוס באוויר')}</span>
                    </div>
                    {f.aircraft?.type && f.aircraft?.registration && <span className="muted" style={{ marginTop: -6 }}>{tr('רישום: {reg}', { reg: f.aircraft.registration })}</span>}
                    {typeInfo && (
                      <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <div className="tile"><span className="label">{tr('אורך')}</span><span className="value" style={{ fontSize: 17 }}>{tr('{n} מ׳', { n: typeInfo.lengthM })}</span></div>
                        <div className="tile"><span className="label">{tr('מוטת כנפיים')}</span><span className="value" style={{ fontSize: 17 }}>{tr('{n} מ׳', { n: typeInfo.spanM })}</span></div>
                        <div className="tile"><span className="label">{tr('תצורה')}</span><span className="value" style={{ fontSize: 17, direction: 'ltr', textAlign: tr.dir === 'rtl' ? 'right' : 'left' }}>{typeInfo.layout}</span></div>
                      </div>
                    )}
                    {seat && typeInfo && seatSide(seat, typeInfo.layout, tr) && <span className="strong" style={{ color: 'var(--good)' }}>{tr('מושב {seat}: {side}', { seat, side: seatSide(seat, typeInfo.layout, tr).text })}</span>}
                    {typeInfo?.fact && <span style={{ fontSize: 14, lineHeight: 1.55 }}>✦ {typeInfo.fact}</span>}
                  </>
                }
              />
      </>
    );
    const codeshareCard = <CodeshareCard f={f} />;
    const destTeaser = <DestinationTeaser f={f} onOpen={goDest} />;
    const stage = flightStage({ arrivingTLV, depAt: t.depAt, departed: fs.departed, landed: fs.landed, cancelled }, now);
    const airLead = <AirLead f={f} left={left} arrivingTLV={arrivingTLV} goLive={goLive} />;
    const more = (items) => <MoreDetails>{items}</MoreDetails>;
    const S = {
      cancelled: [pass, more([codeshareCard, timesCard])],
      early: [pass, destTeaser, more([codeshareCard, planeCard, timesCard])],
      today: [leavePick, pass, more([destTeaser, codeshareCard, planeCard, inboundCard, timesCard])],
      airport: [<BoardingLead key="bl" f={f} depAt={t.depAt} />, f.aircraft?.registration ? inboundCard : null, pass, more([destTeaser, codeshareCard, planeCard, gateNote, timesCard])],
      air: arrivingTLV
        ? [airLead, leavePick, pass, more([planeCard, codeshareCard, timesCard])]
        : [airLead, pass, destTeaser, more([planeCard, codeshareCard, timesCard])],
      landed: arrivingTLV
        ? [<LandedLead key="ll" f={f} now={now} waiting />, pass, more([codeshareCard, timesCard, planeCard])]
        : [<LandedLead key="ll" f={f} now={now} />, destTeaser, pass, more([codeshareCard, timesCard, planeCard])],
      before: [leavePick, pass, more([inboundCard, planeCard, codeshareCard, timesCard])]
    };
    if (typeof window !== 'undefined') window.__kanafCtx = { ...(window.__kanafCtx || {}), stage };
    stageView = (S[stage] || S.today).map((x, i) => <Fragment key={i}>{x}</Fragment>);
  }

  const theme = skyTheme(f?.arrival?.timezone || 'Asia/Jerusalem', now);
  const destName = hasFlight && f.arrival.iata ? cityOf(f.arrival, tr) : tr('ישראל');

  return (
    <>
      <header className="hero" style={{ background: theme.bg, color: theme.ink }}>
        <Sky theme={theme} flyer />
        <span className="pill">{pill} ✦</span>
        <h1>{title}</h1>
        {theme.clock && <p style={{ fontSize: 14, opacity: 0.9 }}>{tr('עכשיו {part} ב{city}', { part: tr.raw(theme.name), city: destName })} · {theme.clock}</p>}
        {hasFlight && !editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-dark" onClick={() => setEditing(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            {tr('שנה טיסה או תאריך')}
          </button>
            {!f.liveOnly && <ShareButton f={f} />}
          </div>
        )}
      </header>

      <div className="content">
        {loading && !editing && <section className="card big"><PlaneLoader text={tr('טוען את הטיסה…')} /></section>}
        {(editing || (!hasFlight && !loading)) && search}
        {error && <div className="error" role="alert">{error}</div>}

        {hasFlight && f.liveOnly && (
          <>
            <section className="card big">
              <div className="row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AirlineLogo iata={airIata(f)} name={f.airline} size={30} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="strong">{f.airline || f.callsign}</span>
                    <span className="muted small">{tr('אות קריאה {callsign}', { callsign: f.callsign })}</span>
                  </span>
                </span>
                <span className="badge good">{f.live?.isGround ? tr('על הקרקע') : tr('באוויר')}</span>
              </div>
              <span style={{ fontSize: 15 }}>{f.aircraft?.type ? aircraftName(f.aircraft.type, tr) : tr('דגם לא ידוע')}{f.aircraft?.registration ? ` · ${f.aircraft.registration}` : ''}</span>
              {f.live && !f.live.isGround && (
                <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div className="tile"><span className="label">{tr('גובה')}</span><span className="value" style={{ fontSize: 17 }}>{(Math.round(f.live.altitudeM * 3.28084 / 100) * 100).toLocaleString('en-US')}</span></div>
                  <div className="tile"><span className="label">{tr('מהירות')}</span><span className="value" style={{ fontSize: 17 }}>{Math.round(f.live.speedKmh)}</span></div>
                  <div className="tile"><span className="label">{tr('מעל')}</span><span className="value" style={{ fontSize: 15 }}>{f.view?.over?.name || '—'}</span></div>
                </div>
              )}
              <button type="button" className="btn-sun" onClick={goLive} style={{ flex: 'none' }}>{tr('למסך בזמן הטיסה')} {GO[tr.dir]}</button>
            </section>
            <div className="card cream" role="status" style={{ fontSize: 14, lineHeight: 1.55 }}>
              {f.liveOnlyReason === 'callsign'
                ? tr('זה אות קריאה של מטוס ולא מספר טיסה, אז יש לנו רק מיקום חי, בלי זמנים, שער או יעד. כדי לראות את כל הפרטים, חפש לפי מספר הטיסה שבכרטיס.')
                : tr('שירות הזמנים לא זמין כרגע, אז מוצג רק המיקום החי של המטוס, בלי זמנים, שער או יעד.')}
            </div>
          </>
        )}

        {hasFlight && !f.liveOnly && (
          <>
            {f.stale && (
              <div className="card cream" role="status" style={{ fontSize: 14 }}>
                {tr('שירות הזמנים לא זמין כרגע, אז מוצגים הנתונים האחרונים ששמרנו ({ago}). המיקום החי ממשיך להתעדכן.', { ago: agoLabel(now - Date.parse(f.fetchedAt), tr) })}
              </div>
            )}
            <AirlineAlert f={f} goStatus={goStatus} />
            {changes && (
              <section className="card change-alert" role="status">
                <div className="row">
                  <span className="strong">{tr('🔔 עדכון חדש מנתב״ג')}</span>
                  <button type="button" onClick={clearChanges} aria-label={tr('סגור')} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'inherit' }}>✕</button>
                </div>
                {changes.items.map((x) => <span key={x} style={{ fontSize: 15, fontWeight: 700 }}>{x}</span>)}
              </section>
            )}
            {stageView}




          </>
        )}
      </div>
    </>
  );
}

function LiveTab({ f, now, onRefresh, loading, liveLoading }) {
  const tr = useT();
  if (!f) {
    return (
      <>
        <header className="hero short"><h1>{tr('בזמן הטיסה')}</h1></header>
        <div className="content flat"><div className="card">{tr('חפש טיסה בלשונית "טיסות" כדי לראות כאן נתונים חיים.')}</div></div>
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
    const info = getTypeInfo(f.aircraft?.type, tr);
    mySide = seatSide(seat, info ? info.layout : '3-3', tr)?.side || null;
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
  const phaseNames = [tr('המראה'), tr('טיפוס'), tr('שיוט'), tr('ירידה'), tr('נחיתה')];
  const phaseText = [
    tr('המטוס עוד על הקרקע. ההמראה מתוכננת ל-{time}.', { time: depTime }),
    tr('המטוס מטפס לגובה השיוט. המנועים עובדים חזק, וזה רגיל לגמרי.'),
    tr('הטייס האוטומטי מחזיק גובה ומהירות קבועים. שינויים קלים ברעש המנועים הם תיקונים רגילים.'),
    tr('המטוס יורד בהדרגה ומאט. לחץ קל באוזניים הוא רגיל, ובליעה או פיהוק עוזרים.'),
    tr('נחתת. ברוך הבא!')
  ];
  const title = landed ? tr('{flight} נחתה', { flight: f.flight }) : departed ? tr('{flight} בשמיים!', { flight: f.flight }) : tr('{flight} לפני המראה', { flight: f.flight });

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
          <span className="pill">{agoLabel(now - Date.parse(live?.updated || f.fetchedAt), tr)}</span>
        </div>
        <svg width="100%" height="100" viewBox="0 0 350 100" style={{ position: 'relative', overflow: 'visible', transform: tr.dir === 'ltr' ? 'scaleX(-1)' : undefined }} role="img" aria-label={tr('התקדמות הטיסה: {n} אחוז', { n: Math.round(progress * 100) })}>
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
            <span className="small muted">{tr('סטטוס')}</span>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{statusOf(f, tr).text}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            <span className="small muted">{departed && !landed ? tr('נותרו') : landed ? tr('שעת נחיתה') : tr('המראה מתוכננת')}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--coral-ink)' }}>{landed ? (hhmm(f.arrival.actual || f.arrival.estimated || f.arrival.scheduled) || '—') : departed ? (left == null ? '—' : left > 0 ? minutesLabel(left, tr) : tr('עוד רגע')) : (depTime || '—')}</span>
          </div>
        </section>

        {f.view?.over && (
          <section className="card big" style={{ gap: 6 }}>
            <span className="small muted">{f.viewEstimated ? tr('בערך מעל') : live && !live.isGround ? tr('אתה עכשיו מעל') : tr('המטוס נמצא ב')}</span>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{f.view.over.name}</span>
            {f.viewEstimated && <span className="small muted">{tr('הערכה לפי הזמן שעבר מההמראה ולפי המסלול הקצר. אין כרגע קליטה של המשדר של המטוס באזור הזה.')}</span>}
          </section>
        )}

        {f.view?.left && f.view?.right && (
          <section className="card mint">
            <h2>{tr('מה רואים מהחלון')}</h2>
            {[[tr('שמאל'), f.view.left, true, 'left'], [tr('ימין'), f.view.right, false, 'right']].map(([label, s, dark, sideKey]) => (
              <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="badge" style={{ background: dark ? 'var(--ink)' : '#fff', color: dark ? '#fff' : 'var(--ink)', flexShrink: 0 }}>{label}{mySide === sideKey ? ` · ${tr('הצד שלך')}` : ''}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14, lineHeight: 1.5 }}>
                  <span className="strong">{s.area.name}</span>
                  {s.sights.length > 0
                    ? s.sights.map((x) => <span key={x.name}>{x.name} · {tr('כ-{km} ק״מ', { km: x.km })}</span>)
                    : <span className="muted">{tr('אין נקודות ציון מוכרות בטווח הראייה')}</span>}
                </div>
              </div>
            ))}
            <span className="small muted">{tr('טווח ראייה מהגובה הנוכחי: עד כ-{km} ק״מ, אם אין עננים. מושב A הוא בדרך כלל חלון בצד שמאל.', { km: f.view.visibleKm })}</span>
          </section>
        )}

        {liveLoading && !live ? (
          <section className="card"><PlaneLoader text={tr('מחפש את המטוס באוויר…')} /></section>
        ) : live && !live.isGround ? (
          <div className="tiles two">
            <div className="tile"><span className="label">{tr('גובה')}</span><span className="value">{tr('{ft} רגל', { ft: (Math.round(live.altitudeM * 3.28084 / 100) * 100).toLocaleString('en-US') })}</span><span className="small muted">{tr('כ-{km} ק״מ', { km: (live.altitudeM / 1000).toFixed(1) })}</span></div>
            <div className="tile"><span className="label">{tr('מהירות קרקע')}</span><span className="value">{tr('{n} קמ״ש', { n: Math.round(live.speedKmh) })}</span></div>
            <div className="tile"><span className="label">{tr('כיוון טיסה')}</span><span className="value">{Math.round(live.direction)}°</span></div>
            {typeof live.outsideC === 'number'
              ? <div className="tile"><span className="label">{tr('טמפרטורה בחוץ')}</span><span className="value">{'\u200e'}{Math.round(live.outsideC)}°C</span></div>
              : <div className="tile"><span className="label">{tr('מיקום')}</span><span className="value" style={{ fontSize: 16 }}>{live.latitude.toFixed(2)}°, {live.longitude.toFixed(2)}°</span></div>}
          </div>
        ) : (
          <div className="card cream">{landed ? tr('הטיסה נחתה.') : departed ? (f.viewEstimated ? tr('אין כרגע קליטה של המטוס. מעל ירדן, סעודיה והמפרץ יש מעט קולטנים, אז שם המיקום מוצג כהערכה. הוא יתעדכן לבד כשהמטוס ייקלט שוב.') : tr('המטוס באוויר, אבל כרגע הוא מחוץ לטווח של קולטני המיקום. בחלק מהמסלולים, למשל מעל סעודיה, המפרץ והאוקיינוס ההודי, כמעט אין קליטה. המיקום יופיע לבד כשהמטוס ייקלט שוב.')) : tr('המיקום החי יופיע אחרי ההמראה.')}</div>
        )}

        <section className="card">
          <div className="phases">
            {phaseNames.map((n, i) => (
              <div key={n} className={`phase ${i < phase ? 'done' : ''} ${i === phase ? 'now' : ''}`}><div />{n}</div>
            ))}
          </div>
          <span className="strong">{tr('עכשיו: {phase}', { phase: phase === 0 ? tr('לפני המראה') : phaseNames[phase] })}{phaseEstimated ? ` ${tr('(הערכה לפי הזמן)')}` : ''}</span>
          <span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{phaseText[phase]}</span>
        </section>

        <button type="button" className="btn-sun" onClick={onRefresh} disabled={loading} style={{ flex: 'none' }}>{loading ? tr('מרענן…') : tr('רענן נתונים')}</button>
        <p className="small muted" style={{ margin: 0 }}>{tr('הזמן שנותר מחושב לפי שעת הנחיתה הצפויה ומתעדכן כל 30 שניות.')} {f.liveSource === 'adsb' ? tr('המיקום החי מגיע בזמן אמת מרשת ADS-B (adsb.lol) ומתעדכן כל כמה דקות, ובסוף הטיסה כל דקה.') : tr('הנתונים מהמקור מתעדכנים בכל רענון, בהפרש של כמה דקות.')}
          {f.broadcastCallsign && f.callsign && f.broadcastCallsign !== f.callsign ? ` ${f.matchedByRoute ? tr('המטוס משדר כ-{callsign}, וזיהינו אותו לפי החברה וכיוון הטיסה.', { callsign: f.broadcastCallsign }) : tr('המטוס משדר כ-{callsign}.', { callsign: f.broadcastCallsign })}` : ''}</p>
      </div>
    </>
  );
}

function SeatMap({ layout, seat }) {
  const tr = useT();
  const blocks = seatBlocks(layout);
  const mine = seatSide(seat, layout, tr);
  const rows = 8;
  const wingRows = [3, 4, 5];
  return (
    <div role="img" aria-label={tr('תרשים מושבים טיפוסי בתצורה {layout}', { layout })} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', direction: 'ltr' }}>
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
        <span>{tr('צד ימין')}</span><span>{tr('↑ חרטום המטוס')}</span><span>{tr('צד שמאל')}</span>
      </div>
    </div>
  );
}

function WhereIsPlane({ f, inbound, now }) {
  const tr = useT();
  const reg = f?.aircraft?.registration;
  if (!reg) return null;
  const { departed, landed } = flightState(f);
  if (departed && !landed && f.live && !f.live.isGround) {
    return (
      <section className="card mint">
        <h2>{tr('איפה המטוס עכשיו')}</h2>
        <span className="strong">{tr('המטוס בטיסה שלך, {flight}', { flight: f.flight })}</span>
        <span style={{ fontSize: 14 }}>{f.view?.over?.name ? `${tr('מעל {place}', { place: f.view.over.name })} · ` : ''}{tr('{ft} רגל', { ft: (Math.round(f.live.altitudeM * 3.28084 / 100) * 100).toLocaleString('en-US') })} · {tr('{n} קמ״ש', { n: Math.round(f.live.speedKmh) })}</span>
      </section>
    );
  }
  if (inbound && !inbound.error && inbound.state !== 'is_our_flight') return <InboundCard f={f} inbound={inbound} now={now} />;
  return null;
}

const pickPhoto = (data) => {
  const p = (data?.photos || [])[0];
  if (!p || !(p.thumbnail_large?.src || p.thumbnail?.src)) return null;
  return {
    found: true,
    src: p.thumbnail_large?.src || p.thumbnail.src,
    width: p.thumbnail_large?.size?.width || p.thumbnail?.size?.width || null,
    height: p.thumbnail_large?.size?.height || p.thumbnail?.size?.height || null,
    photographer: p.photographer || null,
    link: p.link || null
  };
};

// קודם דרך השרת שלנו (עם מטמון); אם הוא לא קיבל תמונה, הדפדפן פונה ישירות ל-Planespotters,
// לפי רישום ואז לפי קוד המשדר של המטוס
async function loadPhoto(reg, hex) {
  try {
    const b = await (await fetch(`/api/photo?reg=${encodeURIComponent(reg)}`)).json();
    if (b?.found) return b;
  } catch {}
  const urls = [`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`];
  if (hex) urls.push(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(hex)}`);
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) { const ph = pickPhoto(await r.json()); if (ph) return ph; }
    } catch {}
  }
  return { found: false };
}

function AircraftPhoto({ reg, hex }) {
  const tr = useT();
  const [photo, setPhoto] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setPhoto(null); setFailed(false);
    if (!reg) return;
    let stop = false;
    loadPhoto(reg, hex).then((b) => { if (!stop) setPhoto(b); });
    return () => { stop = true; };
  }, [reg, hex]);
  if (reg && !photo) return <section className="card" style={{ minHeight: 160, justifyContent: 'center' }}><PlaneLoader text={tr('מחפש תמונה של המטוס…')} /></section>;
  if (!reg || !photo?.found || failed) return null;
  return (
    <figure className="card" style={{ margin: 0, padding: 0, overflow: 'hidden', gap: 0 }}>
      <img
        src={photo.src}
        alt={photo.photographer ? tr('המטוס {reg}, צילום: {by}', { reg, by: photo.photographer }) : tr('המטוס {reg}', { reg })}
        width={photo.width || undefined}
        height={photo.height || undefined}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : '3 / 2', objectFit: 'cover', background: '#DCEFFB' }}
      />
      <figcaption style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{tr('המטוס האמיתי, {reg}', { reg })}</span>
        {photo.link
          ? <a href={photo.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--coral-ink)' }}>© {photo.photographer || tr('צלם')} / Planespotters.net</a>
          : <span>© {photo.photographer || tr('צלם')} / Planespotters.net</span>}
      </figcaption>
    </figure>
  );
}

function AircraftTab({ f, back, inbound, now }) {
  const tr = useT();
  const type = f?.aircraft?.type;
  const info = type ? getTypeInfo(type, tr) : null;
  const [seat, setSeat] = useState('');
  useEffect(() => { try { setSeat(localStorage.getItem('kanaf:seat') || ''); } catch {} }, []);
  const saveSeat = (v) => { const x = v.toUpperCase().replace(/\s+/g, ''); setSeat(x); try { localStorage.setItem('kanaf:seat', x); } catch {} };
  const mine = info ? seatSide(seat, info.layout, tr) : null;

  return (
    <>
      <header className="hero peach short">
        <div className="sun" style={{ opacity: 0.85 }} aria-hidden="true" />
        <button type="button" className="pill" onClick={back} style={{ border: 'none', cursor: 'pointer', fontSize: 15 }}>{BACK[tr.dir]} {tr('לטיסה שלי')}</button>
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="110" height="110" viewBox="0 0 24 24" fill="#fff" stroke="#0E2A47" strokeWidth="0.7" style={{ transform: 'rotate(-35deg)' }} aria-hidden="true">
            <path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" />
          </svg>
        </div>
        {f && <AirlineLogo iata={airIata(f)} name={f.airline} size={34} />}
        <h1 style={{ fontSize: 28 }}>{type ? aircraftName(type, tr) : tr('המטוס שלך')}</h1>
        <p style={{ color: '#4A2212' }}>{f?.airline ? `${f.airline} · ` : ''}{f?.aircraft?.registration ? tr('רישום: {reg}', { reg: f.aircraft.registration }) : tr('הרישום יופיע כשחברת התעופה תשבץ מטוס')}{info ? ` · ${info.body}` : ''}</p>
      </header>
      <div className="content flat">
        <AircraftPhoto reg={f?.aircraft?.registration} hex={f?.aircraft?.hex} />
        {f && <WhereIsPlane f={f} inbound={inbound} now={now} />}

        {info ? (
          <>
            <div className="tiles two">
              <div className="tile"><span className="label">{tr('אורך')}</span><span className="value">{tr('{n} מ׳', { n: info.lengthM })}</span></div>
              <div className="tile"><span className="label">{tr('מוטת כנפיים')}</span><span className="value">{tr('{n} מ׳', { n: info.spanM })}</span></div>
              <div className="tile"><span className="label">{tr('טיסה ראשונה של הדגם')}</span><span className="value">{info.firstFlight}</span></div>
              <div className="tile"><span className="label">{tr('תצורה טיפוסית')}</span><span className="value" style={{ direction: 'ltr', textAlign: tr.dir === 'rtl' ? 'right' : 'left' }}>{info.layout}</span></div>
            </div>

            <section className="card cream">
              <span className="strong" style={{ color: '#7A5A00' }}>{tr('✦ הידעת?')}</span>
              <span style={{ lineHeight: 1.55 }}>{info.fact}</span>
            </section>

            <section className="card">
              <h2>{tr('איפה אני יושב?')}</h2>
              <div className="field">
                <label htmlFor="seatNo">{tr('מספר המושב שלך')}</label>
                <input id="seatNo" value={seat} onChange={(e) => saveSeat(e.target.value)} placeholder={tr('לדוגמה 32A')} maxLength={3} />
              </div>
              {mine && (
                <span className="strong" style={{ fontSize: 16, color: mine.kind === 'window' ? 'var(--good)' : 'var(--ink)' }}>
                  {seat}: {mine.text}{mine.kind === 'window' ? ` · ${tr('בלשונית "בטיסה" תראה מה רואים מהצד שלך')}` : ''}
                </span>
              )}
              {seat && !mine && <span className="muted" style={{ fontSize: 14 }}>{tr('לא הצלחנו לזהות את המושב. כתוב מספר שורה ואות, למשל 32A.')}</span>}
              <SeatMap layout={info.layout} seat={seat} />
              <span className="small muted">{tr('תרשים כללי של תצורה {layout}, לא המפה של חברת התעופה שלך. הפס הכחול מסמן בערך את אזור הכנף. החברות משנות את מספר השורות ואת האותיות, אבל A הוא כמעט תמיד חלון בצד שמאל.', { layout: info.layout })}</span>
              <a href="https://www.aerolopa.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 700, color: 'var(--coral-ink)' }}>{tr('מפת מושבים מדויקת לפי חברת תעופה (aeroLOPA)')} {GO[tr.dir]}</a>
            </section>
          </>
        ) : (
          <section className="card cream">
            <span style={{ lineHeight: 1.55 }}>{type ? tr('אין לנו עדיין נתונים על הדגם הזה.') : tr('כשחברת התעופה תשבץ מטוס לטיסה, יופיעו כאן הדגם, הנתונים ותרשים המושבים.')}</span>
          </section>
        )}
      </div>
    </>
  );
}

export default function App() {
  const tr = useT();
  const [flightNo, setFlightNo] = useState('');
  const [date, setDate] = useState('');
  const [flight, setFlight] = useState(null);
  const loadedAt = useRef(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('flights');
  // כל מעבר בין מסכים, וכל טיסה חדשה שנפתחת, מתחילים מראש העמוד
  useEffect(() => { window.scrollTo(0, 0); }, [tab, flight?.flight, flight?.date]);
  // פרטים שמצורפים אוטומטית ל"דווח על בעיה"
  useEffect(() => { window.__kanafCtx = { ...(window.__kanafCtx || {}), flight: flight?.flight || null, date: flight?.date || null, tab }; }, [flight, tab]);
  const [now, setNow] = useState(Date.now());
  const [adsb, setAdsb] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [wasAirborne, setWasAirborne] = useState(false);

  const search = useCallback(async (no, d) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(apiUrl(tr, `/api/flight?flight=${encodeURIComponent(no)}&date=${encodeURIComponent(d)}`));
      const body = await res.json();
      if (!res.ok) { setError(body.error || tr('משהו השתבש')); }
      else {
        setFlight(body); setEditing(false); setChanges(null); loadedAt.current = Date.now();
        // חיפושים אחרונים: עד 3 טיסות, נשמרות רק בטלפון
        try {
          const label = `${body.flight}${body.arrival?.iata && body.arrival.iata !== 'TLV' ? ` · ${body.arrival.cityHe || body.arrival.iata}` : body.departure?.cityHe ? ` · ${tr('מ{city}', { city: body.departure.cityHe })}` : ''}`;
          const list = JSON.parse(localStorage.getItem('kanaf:recent') || '[]').filter((x) => !(x.no === no && x.d === d));
          localStorage.setItem('kanaf:recent', JSON.stringify([{ no, d, label }, ...list].slice(0, 3)));
        } catch {}
      }
    } catch {
      setError(tr('אין חיבור לאינטרנט'));
    }
    setLoading(false);
  }, [tr]);

  useEffect(() => {
    // כל פתיחה מתחילה במסך "לאן טסים?". רק קישור משותף (?f=) פותח ישר טיסה
    let no = '', d = todayIn();
    // קישור משותף: ?f=LY315&d=2026-11-25 פותח ישר את הטיסה הזו
    try {
      const u = new URLSearchParams(window.location.search);
      const sf = (u.get('f') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (sf) { no = sf; d = /^\d{4}-\d{2}-\d{2}$/.test(u.get('d') || '') ? u.get('d') : todayIn(); }
      // מנקים את הקישור מהכתובת, כדי שרענון או פתיחה מחדש יחזירו למסך הפתיחה
      if (sf) window.history.replaceState(null, '', window.location.pathname);
    } catch {}
    setFlightNo(no); setDate(d);
    if (no) search(no, d);
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [search]);

  // רענון שקט של פרטי הטיסה כל 3 דקות (דלפקים, טרמינל, שעות), עד הנחיתה. כשמשהו חשוב משתנה, מציגים הודעה
  const [changes, setChanges] = useState(null);
  usePolling(async (stopped) => {
    if (!flight || flight.liveOnly || flight.arrival?.actual || Date.now() - loadedAt.current < 60000) return true;
    try {
      const res = await fetch(apiUrl(tr, `/api/flight?flight=${encodeURIComponent(flight.flight)}&date=${encodeURIComponent(lookupDate(flight))}`));
      if (!res.ok) return false;
      const body = await res.json();
      if (stopped() || body.flight !== flight.flight) return true;
      const diff = [];
      const cin = (x) => [x.departure?.checkin, x.departure?.checkinZone].filter(Boolean).join(` · ${tr('אזור')} `);
      if (cin(body) && cin(body) !== cin(flight)) diff.push(tr('דלפקי הצ׳ק-אין עכשיו: {desks}', { desks: cin(body) }));
      if (body.departure?.terminal && body.departure.terminal !== flight.departure?.terminal) diff.push(tr('טרמינל {n}', { n: body.departure.terminal }));
      const t = (x) => x.departure?.estimated || x.departure?.scheduled;
      if (t(body) && t(flight) && t(body) !== t(flight)) diff.push(tr('שעת ההמראה עכשיו {time}', { time: hhmm(t(body)) }));
      if (body.statusEn !== flight.statusEn && /CANCEL/.test(body.statusEn || '')) diff.push(tr('הטיסה בוטלה'));
      setFlight(body);
      if (diff.length) setChanges({ at: Date.now(), items: diff });
    } catch { return false; }
    return true;
  }, 180000, [flight?.flight, flight?.date]);

  // מיקום חי בזמן אמת מ-adsb.lol, כל 15 שניות כשהדף פתוח
  const altCallsign = useRef(null);
  // בלי אות קריאה משלה (למשל TG4586, כשאין לנו את קוד ה-ICAO של החברה): לוקחים את אות הקריאה של טיסת שיתוף הקוד
  const callsign = flight?.callsign || (flight?.codeshares || []).map((c) => c.callsign).find(Boolean) || null;
  const flightReg = flight?.aircraft?.registration;
  useEffect(() => {
    setAdsb(null); setEstimate(null); setWasAirborne(false); altCallsign.current = null;
    setLiveLoading(!!callsign);
  }, [callsign, flightReg]);
  usePolling(async (stopped) => {
    if (!callsign) return true;
    // לפני ההמראה המטוס בדרך כלל לא משדר: לא שואלים עד כ-45 דקות לפני, כדי לחסוך בקשות
    const depAt = flight ? localToInstant(flight.departure.actual || flight.departure.estimated || flight.departure.scheduled, flight.departure.timezone) : null;
    if (depAt && !flight.departure.actual && depAt - Date.now() > 45 * 60e3) { if (!stopped()) setLiveLoading(false); return true; }
    let ok = false;
    try {
      const q = new URLSearchParams({ callsign, reg: flightReg || '', alt: altCallsign.current || '' });
      const cs = (flight?.codeshares || []).map((c) => c.callsign).filter(Boolean);
      if (cs.length) q.set('cs', cs.join(','));
      if (flight?.source === 'iaa') {
        q.set('from', flight.departure.iata || ''); q.set('to', flight.arrival.iata || ''); q.set('dir', flight.direction || 'departure');
        const eta = localToInstant(flight.arrival.estimated || flight.arrival.scheduled, flight.arrival.timezone);
        if (eta) q.set('eta', String(Math.round(eta / 60000) * 60000));
        const dep = localToInstant(flight.departure.actual || flight.departure.estimated || flight.departure.scheduled, flight.departure.timezone);
        if (dep) q.set('dep', String(Math.round(dep / 60000) * 60000));
      }
      const res = await fetch(apiUrl(tr, `/api/live?${q}`));
      const body = await res.json();
      ok = res.ok;
      if (!stopped() && res.ok) setEstimate(body.found ? null : body.estimate || null);
      if (!stopped() && res.ok && body.found) {
        setAdsb(body);
        if (body.broadcastCallsign) altCallsign.current = body.broadcastCallsign;
        if (!body.live.isGround) setWasAirborne(true);
      }
    } catch {}
    if (!stopped()) setLiveLoading(false);
    return ok;
  }, 60000, [callsign, flightReg]);

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
        const res = await fetch(apiUrl(tr, `/api/inbound?${q}`));
        const body = await res.json();
        if (!stop && res.ok) setInbound(body);
      } catch {}
    };
    load();
    const id = setInterval(load, 180000);
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
          registration: adsb.registration || flight.aircraft?.registration,
          hex: adsb.hex || null
        }
      }
    : flight && estimate && !landedBySource
      ? { ...flight, view: estimate.view, viewEstimated: true }
      : flight;

  const searchCard = (
    <>
    <DestinationPicker
      onPick={(no, d) => { setFlightNo(no); setDate(d); setEditing(false); search(no, d); }}
      onCancel={flight ? () => setEditing(false) : null}
      numberSearch={<SearchCard flightNo={flightNo} setFlightNo={setFlightNo} date={date} setDate={setDate} loading={loading}
        onSearch={() => search(flightNo, date)} onCancel={flight ? () => setEditing(false) : null} />} />
    {!flight && <InstallHint />}
    </>
  );

  return (
    <main className="app">
      <BrandBar />
      {tab === 'flights' && <FlightsTab f={view} now={now} editing={editing} setEditing={setEditing} search={searchCard} error={error} changes={changes} clearChanges={() => setChanges(null)} goAircraft={() => setTab('aircraft')} goDest={() => setTab('dest')} inbound={inbound} goStatus={() => setTab('status')} goLive={() => setTab('live')} loading={loading} liveLoading={liveLoading} />}
      {tab === 'live' && <LiveTab f={view} now={now} liveLoading={liveLoading} loading={loading} onRefresh={() => search(flightNo, date)} />}
      {tab === 'nearby' && <NearbyTab now={now} />}
      {tab === 'status' && <StatusTab />}
      {tab === 'board' && <BoardTab now={now} onOpen={(no, d) => { setFlightNo(no); setDate(d); setEditing(false); setTab('flights'); search(no, d); }} />}
      {tab === 'dest' && <DestinationTab f={view} back={() => setTab('flights')} />}
      {tab === 'aircraft' && <AircraftTab f={view} back={() => setTab('flights')} inbound={inbound} now={now} />}

      <p className="small muted" style={{ textAlign: 'center', margin: '20px 0 0' }}><a href={tr.href('/terms')} style={{ color: 'inherit' }}>{tr('תנאי שימוש ופרטיות')}</a> · <a href={tr.href('/accessibility')} style={{ color: 'inherit' }}>{tr('הצהרת נגישות')}</a><br />{tr('המידע ממקורות ציבוריים ואינו רשמי. השימוש בו באחריות המשתמש בלבד.')}</p>

      <nav className="nav" aria-label={tr('ניווט ראשי')}>
        <button type="button" className={tab === 'flights' ? 'active' : ''} onClick={() => setTab('flights')}><span><PlaneIcon flip={tr.dir === 'rtl'} /></span>{tr('טיסות')}</button>
        <button type="button" className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}><span><GaugeIcon /></span>{tr('בטיסה')}</button>
        <button type="button" className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}><span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h4M7 13h4M7 17h4M15 9h2M15 13h2M15 17h2" /></svg></span>{tr('לוח')}</button>
        <button type="button" className={tab === 'nearby' ? 'active' : ''} onClick={() => setTab('nearby')}><span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg></span>{tr('מעליי')}</button>
        <button type="button" className={tab === 'status' ? 'active' : ''} onClick={() => setTab('status')}><span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18h3" /></svg></span>{tr('מי טס')}</button>
      </nav>
    </main>
  );
}
