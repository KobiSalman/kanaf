'use client';
import { useEffect, useMemo, useState } from 'react';
import AirlineLogo from './AirlineLogo';

// "לאן טסים?": מקלידים יעד, בוחרים מההשלמה, ואז בוחרים טיסה מהרשימה של נתב״ג
const norm = (s) => String(s || '').toLowerCase().replace(/["'״׳\-.]/g, '').replace(/\s+/g, ' ').trim();

function score(d, q) {
  const fields = [[norm(d.city), 0], [norm(d.cityEn), 0], [norm(d.country), 2], [norm(d.countryEn), 2], [norm(d.loc), 1]];
  let best = Infinity;
  for (const [f, w] of fields) {
    if (!f) continue;
    if (f.startsWith(q)) best = Math.min(best, w);
    else if (f.split(' ').some((x) => x.startsWith(q))) best = Math.min(best, w + 1);
    else if (q.length >= 3 && f.includes(q)) best = Math.min(best, w + 3);
  }
  return best;
}

const dayLabel = (ptol) => {
  const day = ptol.slice(0, 10);
  const fmt = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(ms);
  if (day === fmt(Date.now())) return 'היום';
  if (day === fmt(Date.now() + 864e5)) return 'מחר';
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
};

export default function DestinationPicker({ onPick, onCancel, numberSearch }) {
  const [mode, setMode] = useState('dest');
  const [dests, setDests] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [dest, setDest] = useState(null);
  const [flights, setFlights] = useState(null);

  useEffect(() => {
    fetch('/api/destinations').then((r) => r.json().then((b) => (r.ok ? setDests(b.destinations) : setError(b.error || 'משהו השתבש'))))
      .catch(() => setError('אין חיבור לאינטרנט'));
  }, []);

  useEffect(() => {
    if (!dest) return;
    setFlights(null);
    fetch(`/api/board?dir=D&loc=${encodeURIComponent(dest.loc)}`).then((r) => r.json()).then((b) => {
      // טיסות בשיתוף קוד (LY339, KL2475…) מוצגות כשורה אחת עם כל המספרים
      const groups = new Map();
      for (const r of b.rows || []) {
        if (!Number.isFinite(r.fn) || /DEPARTED/.test(r.st)) continue;
        const key = r.ptol;
        const g = groups.get(key) || { ptol: r.ptol, st: r.st, stHe: r.stHe, term: r.term, codes: [] };
        g.codes.push({ op: r.op, fn: r.fn, opName: r.opName });
        groups.set(key, g);
      }
      const list = [...groups.values()].map((g) => ({ ...g, codes: g.codes.sort((a, b) => a.fn - b.fn) })).sort((a, b) => a.ptol.localeCompare(b.ptol));
      setFlights(list);
    }).catch(() => setFlights([]));
  }, [dest]);

  const nq = norm(q);
  const suggestions = useMemo(() => {
    if (!dests) return [];
    if (!nq) return dests.slice(0, 2);
    return dests.map((d) => ({ d, s: score(d, nq) })).filter((x) => x.s < Infinity)
      .sort((a, b) => a.s - b.s || b.d.flights - a.d.flights).slice(0, 2).map((x) => x.d);
  }, [dests, nq]);

  if (mode === 'number') {
    return (
      <>
        {numberSearch}
        <button type="button" className="btn-ghost" onClick={() => setMode('dest')} style={{ alignSelf: 'center' }}>← חיפוש לפי יעד</button>
      </>
    );
  }

  if (dest) {
    let lastDay = null;
    return (
      <section className="card big" style={{ gap: 10 }}>
        <div className="row">
          <h2 style={{ fontSize: 18 }}>טיסות ל{dest.city}</h2>
          <button type="button" className="btn-ghost" onClick={() => { setDest(null); setFlights(null); }} style={{ height: 36, padding: '0 12px' }}>שנה יעד</button>
        </div>
        {!flights && <span className="muted">טוען טיסות…</span>}
        {flights && flights.length === 0 && <span className="muted">אין טיסות ל{dest.city} בשלושת הימים הקרובים בלוח של נתב״ג.</span>}
        {flights && flights.map((g) => {
          const day = dayLabel(g.ptol);
          const showDay = day !== lastDay; lastDay = day;
          const main = g.codes[0];
          const cancelled = /CANCEL/.test(g.st);
          const late = g.st === 'DELAYED';
          return (
            <div key={g.ptol} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {showDay && <span className="small strong muted" style={{ marginTop: 4 }}>{day}</span>}
              <button type="button" onClick={() => onPick(`${main.op}${main.fn}`, g.ptol.slice(0, 10))}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 16, border: 'none', background: 'var(--ground)', fontFamily: 'inherit', color: 'inherit', textAlign: 'right', cursor: 'pointer', opacity: cancelled ? 0.6 : 1 }}>
                <span style={{ fontSize: 22, fontWeight: 800, minWidth: 62 }}>{g.ptol.slice(11, 16)}</span>
                <AirlineLogo iata={main.op} name={main.opName} size={28} />
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 1 }}>
                  <span className="strong">{main.opName || main.op} · {main.op}{main.fn}</span>
                  {g.codes.length > 1 && <span className="small muted">גם: {g.codes.slice(1).map((c) => `${c.op}${c.fn}`).join(', ')}</span>}
                </span>
                {(cancelled || late) && <span className={`badge ${cancelled ? 'bad' : 'warn'}`}>{g.stHe}</span>}
              </button>
            </div>
          );
        })}
        <span className="small muted">יש לך מספר טיסה אחר בכרטיס? <button type="button" onClick={() => setMode('number')} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--coral-ink)', fontWeight: 700, fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer' }}>חפש לפי מספר</button></span>
      </section>
    );
  }

  return (
    <section className="card big edit" style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="destSearch">עיר או מדינה</label>
        <input id="destSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="לדוגמה: בנגקוק, יוון, London" autoComplete="off"
          role="combobox" aria-expanded={suggestions.length > 0} aria-controls="destList"
          onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); setDest(suggestions[0]); } }} />
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {!dests && !error && <span className="muted">טוען יעדים…</span>}
      {dests && (
        <div id="destList" role="listbox" aria-label="יעדים" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!nq && <span className="small muted">יעדים פופולריים בימים הקרובים</span>}
          {suggestions.map((d) => (
            <button key={d.loc} type="button" role="option" aria-selected="false" onClick={() => setDest(d)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 14, border: 'none', background: 'var(--ground)', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'right' }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="strong" style={{ fontSize: 16 }}>{d.city}</span>
                <span className="small muted">{d.country}{d.loc ? ` · ${d.loc}` : ''}</span>
              </span>
              <span className="small muted">{d.flights} טיסות</span>
            </button>
          ))}
          {nq && suggestions.length === 0 && <span className="muted">לא מצאנו טיסות ל״{q}״ בשלושת הימים הקרובים.</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-ghost" onClick={() => setMode('number')}>יש לי מספר טיסה</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>ביטול</button>}
      </div>
    </section>
  );
}
