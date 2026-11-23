'use client';

import { useEffect, useRef } from 'react';
import { AIRPORTS } from '../lib/airports';

const PLANE_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="#FF7A59" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c.9 0 1.5 1.2 1.5 3v4.5l8 4.5v2l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5l-8 2.5v-2l8-4.5V5c0-1.8.6-3 1.5-3z"/></svg>`;

const dot = (color) =>
  `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(14,42,71,.35)"></div>`;

// קו מסלול "עגול" (קשת גדולה) בין שתי נקודות, כמו שמטוסים טסים באמת
function greatCircle([lat1, lon1], [lat2, lon2], n = 64) {
  const r = Math.PI / 180;
  const p1 = [lat1 * r, lon1 * r], p2 = [lat2 * r, lon2 * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2[0] - p1[0]) / 2) ** 2 + Math.cos(p1[0]) * Math.cos(p2[0]) * Math.sin((p2[1] - p1[1]) / 2) ** 2));
  if (!d) return [[lat1, lon1], [lat2, lon2]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = Math.sin((1 - f) * d) / Math.sin(d), b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(p1[0]) * Math.cos(p1[1]) + b * Math.cos(p2[0]) * Math.cos(p2[1]);
    const y = a * Math.cos(p1[0]) * Math.sin(p1[1]) + b * Math.cos(p2[0]) * Math.sin(p2[1]);
    const z = a * Math.sin(p1[0]) + b * Math.sin(p2[0]);
    pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / r, Math.atan2(y, x) / r]);
  }
  return pts;
}

export default function LiveMap({ live, depIata, arrIata, trail }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const fitted = useRef(false);

  // יצירת המפה פעם אחת
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || map.current || !el.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(m);
      m.setView([32, 34.9], 5);
      layers.current.L = L;
      map.current = m;
      draw();
    })();
    return () => {
      cancelled = true;
      if (map.current) { map.current.remove(); map.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // עדכון הציור בכל שינוי בנתונים
  useEffect(() => { draw(); });

  function draw() {
    const m = map.current, L = layers.current.L;
    if (!m || !L) return;
    const g = layers.current;
    const dep = AIRPORTS[depIata], arr = AIRPORTS[arrIata];

    if (!g.route && dep && arr) {
      g.route = L.polyline(greatCircle(dep, arr), { color: '#0E2A47', weight: 2, dashArray: '6 8', opacity: 0.6 }).addTo(m);
      g.dep = L.marker(dep, { icon: L.divIcon({ html: dot('#0E2A47'), className: '', iconSize: [14, 14], iconAnchor: [7, 7] }) })
        .bindTooltip(depIata, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(m);
      g.arr = L.marker(arr, { icon: L.divIcon({ html: dot('#6EC6FF'), className: '', iconSize: [14, 14], iconAnchor: [7, 7] }) })
        .bindTooltip(arrIata, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(m);
    }

    if (trail && trail.length > 1) {
      if (!g.trail) g.trail = L.polyline(trail, { color: '#FF7A59', weight: 4, opacity: 0.9 }).addTo(m);
      else g.trail.setLatLngs(trail);
    }

    if (live) {
      const pos = [live.latitude, live.longitude];
      const html = `<div style="transform:rotate(${Math.round(live.direction || 0)}deg);width:34px;height:34px;filter:drop-shadow(0 2px 3px rgba(14,42,71,.4))">${PLANE_SVG}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
      if (!g.plane) g.plane = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(m);
      else { g.plane.setLatLng(pos); g.plane.setIcon(icon); }
    }

    if (!fitted.current) {
      const pts = [dep, arr, live && [live.latitude, live.longitude]].filter(Boolean);
      if (pts.length > 1) { m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] }); fitted.current = true; }
      else if (pts.length === 1) { m.setView(pts[0], 7); fitted.current = true; }
    }
  }

  return (
    <div
      ref={el}
      role="region"
      aria-label="מפה חיה של מיקום המטוס"
      style={{ height: 280, borderRadius: 24, overflow: 'hidden', background: '#DCEFFB' }}
    />
  );
}
