'use client';
import { useEffect, useState } from 'react';
import INFO from '../data/destinations-info.json';
import RECS from '../data/recommendations.json';


// כמה שעות הפרש בין היעד לישראל, עכשיו (כולל שעון קיץ)
function offsetMin(tz, at = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(at).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - at) / 60000);
}
function diffLabel(tz) {
  if (!tz) return null;
  const d = (offsetMin(tz) - offsetMin('Asia/Jerusalem')) / 60;
  if (d === 0) return 'אותה שעה כמו בישראל';
  const abs = Math.abs(d);
  const h = abs === 1 ? 'שעה' : abs === 2 ? 'שעתיים' : `${abs % 1 ? abs.toFixed(1) : abs} שעות`;
  return d > 0 ? `${h} קדימה מישראל` : `${h} אחורה מישראל`;
}

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
  const a = f.arrival;
  const key = a.countryEn && INFO.countries[a.countryEn] ? a.countryEn : null;
  const c = key ? INFO.countries[key] : null;
  const rate = useRate(c?.currency.code);
  if (!c || a.iata === 'TLV') return null;
  const city = a.cityHe || a.iata;
  let rateText = null;
  if (rate) {
    const unit = rate.ils >= 0.5 ? 1 : 10 ** Math.ceil(-Math.log10(rate.ils));
    rateText = `${unit.toLocaleString('he-IL')} ${c.currency.name} ≈ ${(rate.ils * unit).toFixed(2)} ₪`;
  }
  return (
    <section className="card" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>רגע לפני שטסים ל{city} {a.countryHe && a.countryHe !== city ? `(${a.countryHe})` : ''}</h2>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Tile label="שפה" value={c.lang} />
        <Tile label="מטבע" value={`${c.currency.name} (${c.currency.code})`} />
        {rateText && <Tile label="שער היום" value={rateText} />}
        {diffLabel(a.timezone) && <Tile label="שעון" value={diffLabel(a.timezone)} />}
        <Tile label="שקע חשמל" value={c.plugs} />
        <Tile label="חירום" value={c.emergency} />
        <Tile label="נהיגה" value={`בצד ${c.drive}`} />
        <Tile label="טיפ" value={c.tip} wide />
      </div>
      {c.extra && <span style={{ fontSize: 14, lineHeight: 1.55 }}>✦ {c.extra}</span>}
      <span className="small muted">כדאי לבדוק לפני הטיסה דרישות כניסה ואשרות, ואת אזהרות המסע של המטה לביטחון לאומי.</span>
    </section>
  );
}

// ---------- המלצות חמות ביעד: מתעדכנות פעם בשבוע ----------
export function DestinationRecs({ f }) {
  const a = f.arrival;
  if (!a?.iata || a.iata === 'TLV') return null;
  const entry = (RECS.cities || []).find((c) => (c.airports || []).includes(a.iata));
  if (!entry || !entry.items?.length) return null;
  const updated = RECS.updatedAt ? new Date(RECS.updatedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : null;
  return (
    <section className="card" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 17 }}>המלצות חמות ב{entry.city} 🔥</h2>
      {entry.items.slice(0, 4).map((it, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: i < Math.min(entry.items.length, 4) - 1 ? '1px solid #EAF1F7' : 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="strong" style={{ fontSize: 15 }}>{it.name}</span>
            {it.kind && <span className="badge good" style={{ fontSize: 11 }}>{it.kind}</span>}
            {it.kosher && <span className="badge warn" style={{ fontSize: 11 }}>כשר</span>}
          </span>
          {it.area && <span className="small muted">{it.area}</span>}
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>{it.blurb}</span>
          {it.source?.url && <a href={it.source.url} target="_blank" rel="noopener noreferrer" className="small" style={{ color: 'var(--coral-ink)' }}>מקור: {it.source.title || 'קישור'}</a>}
        </div>
      ))}
      <span className="small muted">נאסף אוטומטית מכתבות ומדריכים ברשת{updated ? `, עודכן ב-${updated}` : ''}. כדאי לבדוק שעות פתיחה לפני שמגיעים.</span>
    </section>
  );
}

// יש מידע על היעד? (טיסה מנתב״ג למדינה שיש לנו עליה נתונים)
export function destOf(f) {
  const a = f?.arrival;
  if (!a || a.iata === 'TLV' || f.departure?.iata !== 'TLV') return null;
  const c = a.countryEn ? INFO.countries[a.countryEn] : null;
  if (!c) return null;
  return { c, city: a.cityHe || a.iata, country: a.countryHe, tz: a.timezone };
}

function shortDiff(tz) {
  if (!tz) return null;
  const d = (offsetMin(tz) - offsetMin('Asia/Jerusalem')) / 60;
  if (d === 0) return 'אותה שעה';
  return `${Math.abs(d)} שע׳ ${d > 0 ? 'קדימה' : 'אחורה'}`;
}

// ---------- הכרטיס במסך הטיסה: מוביל למסך הטיפים ----------
export function DestinationTeaser({ f, onOpen }) {
  const d = destOf(f);
  if (!d) return null;
  const chips = [['💬', d.c.lang.split(',')[0]], ['💰', d.c.currency.name], ['🕐', shortDiff(d.tz)], ['🔌', d.c.plugs.split(' (')[0]]].filter(([, v]) => v);
  return (
    <button type="button" onClick={onOpen} className="card dest-teaser" style={{ border: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ fontSize: 34, lineHeight: 1 }}>🧳</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#7A3A1E' }}>רגע לפני שטסים</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>טיפים ומידע על {d.city}</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map(([e, v]) => (
          <span key={e} style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 999, padding: '5px 10px', fontSize: 13, fontWeight: 700 }}>{e} {v}</span>
        ))}
      </div>
      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--coral-ink)' }}>לכל הטיפים וההמלצות ←</span>
    </button>
  );
}

// ---------- מסך הטיפים: מידע על היעד והמלצות ----------
export function DestinationTab({ f, back }) {
  const d = destOf(f);
  return (
    <>
      <header className="hero short dest-hero">
        <button type="button" className="pill" onClick={back} style={{ border: 'none', cursor: 'pointer', fontSize: 15 }}>→ לטיסה שלי</button>
        <span aria-hidden="true" style={{ fontSize: 54, lineHeight: 1 }}>🧳</span>
        <h1 style={{ fontSize: 30 }}>{d ? d.city : 'היעד שלך'}</h1>
        <p>{d?.country && d.country !== d.city ? `${d.country} · ` : ''}כל מה שכדאי לדעת לפני שטסים</p>
      </header>
      <div className="content flat">
        {d ? <><DestinationInfo f={f} /><DestinationRecs f={f} /></> : <div className="card">אין לנו עדיין מידע על היעד הזה.</div>}
      </div>
    </>
  );
}
