'use client';
import { useEffect, useState } from 'react';
import INFO from '../data/destinations-info.json';
import RECS from '../data/recommendations.json';
import TravelersArt from './TravelersArt';
import TRANSPORT from '../data/airport-transport.json';
import { offsetMin, diffLabel, clockIn, plugInfo } from '../lib/destLogic';
import { tData } from '../lib/i18n';
import { useT } from './i18n';
export { plugInfo };


function useRate(code) {
  const [rate, setRate] = useState(null);
  useEffect(() => {
    setRate(null);
    if (!code) return;
    fetch(`/api/rate?cur=${code}`).then((r) => (r.ok ? r.json() : null)).then((b) => b?.ils && setRate(b)).catch(() => {});
  }, [code]);
  return rate;
}

function Tile({ label, value, wide }) {
  return (
    <div className="tile" style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <span className="label">{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

// ---------- רגע לפני שטסים: שפה, מטבע, שעון, שקע, חירום וטיפים ----------
export function DestinationInfo({ f }) {
  const tr = useT();
  const a = f.arrival;
  const key = a.countryEn && INFO.countries[a.countryEn] ? a.countryEn : null;
  const c = key ? tData(INFO.countries[key], tr) : null;
  const rate = useRate(c?.currency.code);
  if (!c || a.iata === 'TLV') return null;
  const city = a.cityHe || a.iata;
  let rateText = null;
  if (rate) {
    const unit = rate.ils >= 0.5 ? 1 : 10 ** Math.ceil(-Math.log10(rate.ils));
    rateText = `${unit.toLocaleString(tr.locale)} ${c.currency.name} ≈ ${(rate.ils * unit).toFixed(2)} ₪`;
  }
  return (
    <section className="card" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>{tr('רגע לפני שטסים ל{city}', { city })} {a.countryHe && a.countryHe !== city ? `(${a.countryHe})` : ''}</h2>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Tile label={tr('שפה')} value={c.lang} />
        <Tile label={tr('מטבע')} value={`${c.currency.name} (${c.currency.code})`} />
        {rateText && <Tile label={tr('שער היום')} value={rateText} />}
        {a.timezone && <Tile label={tr('שעון')} value={offsetMin(a.timezone) === offsetMin('Asia/Jerusalem') ? diffLabel(a.timezone, tr) : `${diffLabel(a.timezone, tr, true)} · ${tr('עכשיו שם {time}', { time: clockIn(a.timezone, tr) })}`} />}
        <Tile label={tr('שקע חשמל')} value={plugInfo(c.plugs, tr).text} wide />
        <Tile label={tr('חירום')} value={c.emergency} />
        <Tile label={tr('נהיגה')} value={tr('בצד {side}', { side: c.drive })} />
        <Tile label={tr('טיפ')} value={c.tip} wide />
      </div>
      {c.extra && <span style={{ fontSize: 14, lineHeight: 1.55 }}>✦ {c.extra}</span>}
      <span className="small muted">{tr('כדאי לבדוק לפני הטיסה דרישות כניסה ואשרות, ואת אזהרות המסע של המטה לביטחון לאומי.')}</span>
    </section>
  );
}

// ---------- חטיפי מידע: בירה, מה לטעום, והידעת? ----------
export function DestinationSnacks({ f }) {
  const tr = useT();
  const d = destOf(f, tr);
  if (!d || !d.c.capital) return null;
  return (
    <section className="card snacks" style={{ gap: 12 }}>
      <h2 style={{ fontSize: 17 }}>{tr('חטיפי מידע על {place}', { place: d.country || d.city })}</h2>
      <div className="snack">
        <span className="snack-icon" aria-hidden="true">🏛️</span>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="small muted">{tr('עיר הבירה')}</span>
          <span className="strong" style={{ fontSize: 16 }}>{d.c.capital}</span>
        </span>
      </div>
      <div className="snack" style={{ alignItems: 'flex-start' }}>
        <span className="snack-icon" aria-hidden="true">🍽️</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">{tr('מה חייבים לטעום')}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.c.foods.map((x) => <span key={x} className="food-chip">{x}</span>)}
          </span>
        </span>
      </div>
      <div className="snack" style={{ alignItems: 'flex-start' }}>
        <span className="snack-icon" aria-hidden="true">💡</span>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="small muted">{tr('הידעת?')}</span>
          <span style={{ fontSize: 15, lineHeight: 1.5 }}>{d.c.fact}</span>
        </span>
      </div>
    </section>
  );
}

// ---------- איך מגיעים מהשדה לעיר ----------
export function AirportTransport({ f }) {
  const tr = useT();
  const code = f?.arrival?.iata;
  const t = code && tData(TRANSPORT.airports[code], tr);
  if (!t) return null;
  const city = f.arrival.cityHe || code;
  return (
    <section className="card" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>{tr('איך מגיעים מהשדה ל{city}', { city })}</h2>
      {t.transit.map((x) => (
        <div key={x.name} className="snack" style={{ alignItems: 'flex-start' }}>
          <span className="snack-icon" aria-hidden="true">{x.icon}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="strong" style={{ fontSize: 15 }}><bdi>{x.name}</bdi></span>
            <span style={{ fontSize: 14, lineHeight: 1.5 }}>{x.text}</span>
          </span>
        </div>
      ))}
      <div className="card cream" style={{ padding: 12, gap: 6 }}>
        <span className="strong" style={{ fontSize: 14 }}>{tr('📲 כדאי להוריד כבר בארץ')}</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {t.apps.map((x) => <span key={x} className="food-chip" dir="ltr">{x}</span>)}
        </span>
        <span className="small" style={{ color: '#5C4A12' }}>{tr('אפליקציות נסיעה שפועלות ב{city}. להתקין ולהירשם עם כרטיס אשראי עוד לפני הטיסה, כדי שבנחיתה רק צריך להזמין.', { city })}</span>
      </div>
      {t.tip && <span style={{ fontSize: 14, lineHeight: 1.55 }}>✦ {t.tip}</span>}
      <span className="small muted">{tr.raw(TRANSPORT.note)}</span>
    </section>
  );
}

// ---------- המלצות חמות ביעד: מתעדכנות פעם בשבוע ----------
export function DestinationRecs({ f }) {
  const tr = useT();
  const a = f.arrival;
  if (!a?.iata || a.iata === 'TLV') return null;
  const found = (RECS.cities || []).find((c) => (c.airports || []).includes(a.iata));
  const entry = found && tData(found, tr);
  if (!entry || !entry.items?.length) return null;
  const updated = RECS.updatedAt ? new Date(RECS.updatedAt).toLocaleDateString(tr.locale, { day: 'numeric', month: 'numeric', year: 'numeric' }) : null;
  return (
    <section className="card" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>{tr('המלצות חמות ב{city} 🔥', { city: entry.city })}</h2>
      {entry.items.slice(0, 4).map((it, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: i < Math.min(entry.items.length, 4) - 1 ? '1px solid #EAF1F7' : 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="strong" style={{ fontSize: 15 }}>{it.name}</span>
            {it.kind && <span className="badge good" style={{ fontSize: 11 }}>{it.kind}</span>}
            {it.kosher && <span className="badge warn" style={{ fontSize: 11 }}>{tr('כשר')}</span>}
          </span>
          {it.area && <span className="small muted">{it.area}</span>}
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>{it.blurb}</span>
          {it.source?.url && <a href={it.source.url} target="_blank" rel="noopener noreferrer" className="small" style={{ color: 'var(--coral-ink)' }}>{tr('מקור: {title}', { title: it.source.title || tr('קישור') })}</a>}
        </div>
      ))}
      <span className="small muted">{updated ? tr('נאסף אוטומטית מכתבות ומדריכים ברשת, עודכן ב-{date}.', { date: updated }) : tr('נאסף אוטומטית מכתבות ומדריכים ברשת.')} {tr('כדאי לבדוק שעות פתיחה לפני שמגיעים.')}</span>
    </section>
  );
}

// יש מידע על היעד? (טיסה מנתב״ג למדינה שיש לנו עליה נתונים)
export function destOf(f, tr) {
  const a = f?.arrival;
  if (!a || a.iata === 'TLV' || f.departure?.iata !== 'TLV') return null;
  const c = a.countryEn && INFO.countries[a.countryEn] ? tData(INFO.countries[a.countryEn], tr) : null;
  if (!c) return null;
  return { c, city: a.cityHe || a.iata, country: a.countryHe, tz: a.timezone };
}

function shortDiff(tz, tr) {
  if (!tz) return null;
  const d = (offsetMin(tz) - offsetMin('Asia/Jerusalem')) / 60;
  if (d === 0) return tr('אותה שעה');
  return d > 0 ? tr('{n} שע׳ קדימה', { n: Math.abs(d) }) : tr('{n} שע׳ אחורה', { n: Math.abs(d) });
}

// ---------- הכרטיס במסך הטיסה: מוביל למסך הטיפים ----------
export function DestinationTeaser({ f, onOpen }) {
  const tr = useT();
  const d = destOf(f, tr);
  if (!d) return null;
  const chips = [['💬', d.c.lang.split(',')[0]], ['💰', d.c.currency.name], ['🕐', shortDiff(d.tz, tr)], ['🔌', plugInfo(d.c.plugs, tr).short]].filter(([, v]) => v);
  return (
    <button type="button" onClick={onOpen} className="card dest-teaser" style={{ border: 'none', cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ fontSize: 34, lineHeight: 1 }}>🧳</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#7A3A1E' }}>{tr('רגע לפני שטסים')}</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{tr('טיפים ומידע על {city}', { city: d.city })}</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map(([e, v]) => (
          <span key={e} style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 999, padding: '5px 10px', fontSize: 13, fontWeight: 700 }}>{e} {v}</span>
        ))}
      </div>
      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--coral-ink)' }}>{tr('לכל הטיפים וההמלצות')} {tr.dir === 'rtl' ? '←' : '→'}</span>
    </button>
  );
}

// ---------- מסך הטיפים: מידע על היעד והמלצות ----------
export function DestinationTab({ f, back }) {
  const tr = useT();
  const d = destOf(f, tr);
  return (
    <>
      <header className="dest-hero2">
        <div className="dest-top">
          {d?.c.iso && (
            <div className="dest-flag2" aria-hidden="true">
              <img src={`/flags/${d.c.iso}.svg`} alt="" width="120" height="90" />
              <span className="dest-flag-shine" />
            </div>
          )}
          <div className="dest-text">
            <button type="button" className="pill" onClick={back} style={{ border: 'none', cursor: 'pointer', fontSize: 14, background: 'var(--ground)' }}>{tr.dir === 'rtl' ? '→' : '←'} {tr('לטיסה שלי')}</button>
            <h1>{d ? d.city : tr('היעד שלך')}</h1>
            {d?.country && d.country !== d.city && <span className="dest-country">{d.country}</span>}
            <span className="dest-sub">{tr('מה שכדאי לדעת לפני שטסים')}{'\u00A0'}✈️</span>
          </div>
        </div>
        <TravelersArt />
      </header>
      <div className="content flat">
        {d ? <><DestinationSnacks f={f} /><AirportTransport f={f} /><DestinationInfo f={f} /><DestinationRecs f={f} /></> : <div className="card">{tr('אין לנו עדיין מידע על היעד הזה.')}</div>}
      </div>
    </>
  );
}
