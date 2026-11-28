'use client';

import { useState } from 'react';
import { useT } from './i18n';

// ---------- שמיים לפי השעה ביעד ----------

export function hourIn(timeZone, now = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const h = Number(parts.find((p) => p.type === 'hour').value);
    const m = parts.find((p) => p.type === 'minute').value;
    return { h, label: `${String(h).padStart(2, '0')}:${m}` };
  } catch {
    return { h: 12, label: '' };
  }
}

export function skyTheme(timeZone, now) {
  const { h, label } = hourIn(timeZone || 'Asia/Jerusalem', now);
  if (h >= 20 || h < 5) return { key: 'night', name: 'לילה', bg: 'linear-gradient(180deg, #0B1A3A 0%, #1E3A6E 100%)', ink: '#FFFFFF', clock: label };
  if (h < 7) return { key: 'dawn', name: 'זריחה', bg: 'linear-gradient(180deg, #7FB7FF 0%, #FFC3A1 100%)', ink: '#0E2A47', clock: label };
  if (h < 17) return { key: 'day', name: 'יום', bg: '#6EC6FF', ink: '#0E2A47', clock: label };
  return { key: 'dusk', name: 'שקיעה', bg: 'linear-gradient(180deg, #4E3F8F 0%, #FF8A65 100%)', ink: '#FFFFFF', clock: label };
}

const STARS = [[30, 18], [70, 44], [120, 22], [160, 60], [210, 30], [250, 12], [290, 50], [330, 24], [370, 40], [95, 80], [235, 86], [345, 92]];

export function Sky({ theme, flyer = false }) {
  const t = theme || skyTheme('Asia/Jerusalem');
  const night = t.key === 'night';
  return (
    <>
      {night && STARS.map(([x, y], i) => (
        <span key={i} className="star" aria-hidden="true" style={{ position: 'absolute', right: x, top: y, animationDelay: `${(i % 5) * 0.6}s` }} />
      ))}
      {night ? (
        <div aria-hidden="true" style={{ position: 'absolute', left: 26, top: 34, width: 64, height: 64, borderRadius: 999, background: '#F4F1E1', boxShadow: '0 0 30px rgba(244,241,225,.45)' }} />
      ) : (
        <div aria-hidden="true" style={{ position: 'absolute', left: -24, top: t.key === 'day' ? 26 : 120, width: 110, height: 110, borderRadius: 999, background: t.key === 'dusk' ? '#FFB45C' : '#FFC93C', opacity: t.key === 'day' ? 1 : 0.95 }} />
      )}
      <div className="cloud drift" aria-hidden="true" style={{ left: 40, top: 118, width: 120, height: 36, opacity: night ? 0.12 : 0.9 }} />
      <div className="cloud drift slow" aria-hidden="true" style={{ left: 80, top: 100, width: 60, height: 44, opacity: night ? 0.12 : 0.9 }} />
      <div className="cloud drift" aria-hidden="true" style={{ right: -30, top: 190, width: 140, height: 34, opacity: night ? 0.1 : 0.6 }} />
      {flyer && (
        <div className="flyer" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill={night ? '#F4F1E1' : '#FFFFFF'} stroke={night ? 'none' : '#0E2A47'} strokeWidth="0.6" style={{ transform: 'rotate(-90deg)' }}>
            <path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" />
          </svg>
          <span className="contrail" />
        </div>
      )}
    </>
  );
}

// ---------- מטוס על קשת המסלול ----------

// נקודה וזווית על הקשת M330 84 Q175 -14 20 84, לפי התקדמות 0..1
export function arcPoint(p) {
  const x = (1 - p) ** 2 * 330 + 2 * p * (1 - p) * 175 + p * p * 20;
  const y = (1 - p) ** 2 * 84 + 2 * p * (1 - p) * -14 + p * p * 84;
  const dx = 2 * (1 - p) * (175 - 330) + 2 * p * (20 - 175);
  const dy = 2 * (1 - p) * (-14 - 84) + 2 * p * (84 + 14);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

export function ArcPlane({ progress, ink = '#0E2A47' }) {
  const { x, y, angle } = arcPoint(progress);
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 2s ease-in-out' }}>
      <g className="bob">
        <g style={{ transform: `rotate(${angle + 90}deg)`, transition: 'transform 2s ease-in-out' }}>
          <circle r="17" fill="#FF7A59" stroke="#fff" strokeWidth="3" />
          <path transform="translate(-10.5 -10.5) scale(0.875)" d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z" fill="#fff" />
        </g>
      </g>
    </g>
  );
}

// ---------- כרטיס עלייה למטוס ----------

function Barcode({ seed }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bars = [];
  let x = 0;
  for (let i = 0; i < 90; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const w = 1 + (h % 3);
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y="0" width={w} height="34" fill="#0E2A47" />);
    x += w + 1 + ((h >> 3) % 2);
  }
  return <svg width="100%" height="34" viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" aria-hidden="true">{bars}</svg>;
}

export function BoardingPass({ front, back, seed, label, stamp }) {
  const tr = useT();
  const arrow = tr.dir === 'rtl' ? '←' : '→';
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className={`bp ${flipped ? 'flipped' : ''}`}
      onClick={() => setFlipped((v) => !v)}
      aria-label={`${label}. ${tr('לחץ כדי להפוך את הכרטיס')}`}
      aria-pressed={flipped}
    >
      <div className="bp-inner">
        <div className="bp-face">
          {front}
          {stamp && (
            <div className={`bp-stamp ${stamp.tone || ''}`} role="status">
              <span className="bp-stamp-title">{stamp.title}</span>
              {stamp.line && <span className="bp-stamp-line">{stamp.line}</span>}
              {stamp.sub && <span className="bp-stamp-sub">{stamp.sub}</span>}
            </div>
          )}
          <div className="bp-tear" aria-hidden="true" />
          <div className="bp-bottom">
            <Barcode seed={seed} />
            <span className="small muted">{tr('לחץ להפוך')} {arrow}</span>
          </div>
        </div>
        <div className="bp-face bp-back">
          {back}
          <span className="small muted" style={{ marginTop: 'auto' }}>{tr('לחץ לחזרה')} {arrow}</span>
        </div>
      </div>
    </button>
  );
}
