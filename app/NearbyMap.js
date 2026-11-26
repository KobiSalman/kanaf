'use client';
import { LAND } from '../lib/israelLand';

// מפה קבועה של האזור: קו החוף, ערים, העיגול שבו אנחנו מחפשים מטוסים, והמטוסים עצמם לפי המיקום והכיוון שלהם
const CITIES = [
  ['חיפה', 32.794, 34.989], ['נתניה', 32.33, 34.857], ['תל אביב', 32.08, 34.78], ['ירושלים', 31.768, 35.214],
  ['אשדוד', 31.804, 34.655], ['באר שבע', 31.252, 34.791], ['טבריה', 32.795, 35.531], ['אילת', 29.557, 34.952],
  ['עפולה', 32.607, 35.29], ['אשקלון', 31.669, 34.571], ['דימונה', 31.069, 35.033], ['נהריה', 33.006, 35.095]
];
const AIRPORTS = [['נתב״ג', 32.011, 34.887], ['רמון', 29.724, 35.011]];
const SIZE = 360, KM_DEG = 111.32;

export default function NearbyMap({ center, radiusKm, planes }) {
  const half = radiusKm * 2; // המפה מראה פי 4 מהרדיוס, כדי לראות את הסביבה ולא רק את העיגול
  const s = SIZE / (half * 2);
  const cos = Math.cos((center.lat * Math.PI) / 180);
  const xy = (lat, lon) => [SIZE / 2 + (lon - center.lon) * KM_DEG * cos * s, SIZE / 2 - (lat - center.lat) * KM_DEG * s];
  const inside = ([x, y], m = 0) => x > m && x < SIZE - m && y > m && y < SIZE - m;

  const land = LAND.map((ring) => 'M' + ring.map(([lon, lat]) => xy(lat, lon).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z').join('');
  const r = radiusKm * s;
  const flying = planes.filter((p) => !p.onGround && typeof p.lat === 'number');
  const labeled = new Set(flying.slice(0, 6).map((p) => p.id));

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label={`מפה של ${flying.length} מטוסים ברדיוס ${radiusKm} ק״מ ממך`} style={{ display: 'block', background: '#9ED8F7', direction: 'ltr' }}>
        <path d={land} fill="#F3EBD3" stroke="#D9CBA3" strokeWidth="1" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="rgba(255,122,89,0.10)" stroke="#FF7A59" strokeWidth="1.5" strokeDasharray="5 4" />
        {CITIES.map(([name, lat, lon]) => {
          const p = xy(lat, lon);
          if (!inside(p, 8)) return null;
          return (
            <g key={name}>
              <circle cx={p[0]} cy={p[1]} r="2.5" fill="#4A6380" />
              <text x={p[0] - 5} y={p[1] + 4} fontSize="11" fill="#4A6380" textAnchor="end" fontFamily="Rubik, system-ui">{name}</text>
            </g>
          );
        })}
        {AIRPORTS.map(([name, lat, lon]) => {
          const p = xy(lat, lon);
          if (!inside(p, 8)) return null;
          return (
            <g key={name}>
              <rect x={p[0] - 4} y={p[1] - 4} width="8" height="8" rx="2" fill="#0E2A47" />
              <text x={p[0] + 7} y={p[1] + 4} fontSize="11" fontWeight="700" fill="#0E2A47" fontFamily="Rubik, system-ui">{name}</text>
            </g>
          );
        })}
        {/* המיקום שלך */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r="9" fill="rgba(46,134,222,0.25)" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r="5" fill="#2E86DE" stroke="#fff" strokeWidth="2" />
        {flying.map((p) => {
          const [x, y] = xy(p.lat, p.lon);
          if (!inside([x, y])) return null;
          return (
            <g key={p.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
              <g transform={`rotate(${p.track ?? 0})`}>
                <path d="M0 -9 C1 -9 1.6 -7.6 1.6 -5.6 L1.6 -2 L8 2 L8 3.6 L1.6 1.8 L1.6 5.4 L3.6 7 L3.6 8.2 L0 7.2 L-3.6 8.2 L-3.6 7 L-1.6 5.4 L-1.6 1.8 L-8 3.6 L-8 2 L-1.6 -2 L-1.6 -5.6 C-1.6 -7.6 -1 -9 0 -9 Z"
                  fill="#FF7A59" stroke="#fff" strokeWidth="1" />
              </g>
              {labeled.has(p.id) && p.callsign && (
                <text x="0" y="-12" fontSize="10" fontWeight="700" fill="#0E2A47" textAnchor="middle" fontFamily="Rubik, system-ui"
                  stroke="#fff" strokeWidth="3" paintOrder="stroke">{p.callsign}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="row" style={{ padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }}>
        <span><span style={{ color: '#2E86DE' }}>●</span> המיקום שלך (מעוגל)</span>
        <span><span style={{ color: '#FF7A59' }}>- - -</span> רדיוס {radiusKm} ק״מ</span>
      </div>
    </section>
  );
}
