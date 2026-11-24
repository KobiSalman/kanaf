'use client';

import { useState } from 'react';
import STATUS from '../data/airlines-status.json';

// ICAO (ELY) -> IATA (LY), לפי רשימת החברות שלנו
const ICAO_TO_IATA = Object.fromEntries(STATUS.airlines.filter((a) => a.icao).map((a) => [a.icao, a.iata]));

export function iataFromCallsign(callsign) {
  const icao = (callsign || '').match(/^[A-Z]{3}/)?.[0];
  return icao ? ICAO_TO_IATA[icao] || null : null;
}

// לוגו של חברת התעופה ממאגר לוגואים ציבורי. אם התמונה לא נטענת, מוצג עיגול עם קוד החברה.
export default function AirlineLogo({ iata, name, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const code = (iata || '').toUpperCase();
  if (!code) return null;
  if (failed) {
    return (
      <span aria-label={name || code} style={{ width: size, height: size, borderRadius: 999, background: '#0E2A47', color: '#fff', fontSize: size * 0.34, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {code}
      </span>
    );
  }
  return (
    <span style={{ width: size * 2.2, height: size, borderRadius: 10, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
      <img
        src={`https://pics.avs.io/${Math.round(size * 2.2 * 2)}/${size * 2}/${code}.png`}
        alt={name ? `לוגו ${name}` : `לוגו ${code}`}
        width={Math.round(size * 2.2)}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
      />
    </span>
  );
}
