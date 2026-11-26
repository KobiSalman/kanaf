import { feature } from 'topojson-client';
import fs from 'node:fs';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/land-10m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const B = { w: 33.6, e: 36.4, s: 29.0, n: 33.9 };
const rings = [];
for (const poly of land.features[0].geometry.coordinates) for (const ring of poly) {
  if (!ring.some(([x, y]) => x > B.w && x < B.e && y > B.s && y < B.n)) continue;
  // clip-ish: keep points near the box, simplify by distance
  let out = [], last = null;
  for (const [x, y] of ring) {
    const cx = Math.min(Math.max(x, B.w - 0.5), B.e + 0.5), cy = Math.min(Math.max(y, B.s - 0.5), B.n + 0.5);
    const edge = (cx !== x ? 'x' + cx : '') + (cy !== y ? 'y' + cy : '');
    const pt = [Math.round(cx * 1000) / 1000, Math.round(cy * 1000) / 1000];
    // נקודות שנדחסו לאותה שפה של המסגרת: שומרים רק את האחרונה
    if (edge && last && last.edge === edge && out.length > 1 && out[out.length - 2].edge === edge) { out[out.length - 1] = Object.assign(pt, { edge }); last = out[out.length - 1]; continue; }
    if (last && !edge && Math.hypot(cx - last[0], cy - last[1]) < 0.012) continue;
    last = Object.assign(pt, { edge }); out.push(last);
  }
  if (out.length > 3) rings.push(out.map(([a, b]) => [a, b]));
}
const pts = rings.reduce((a, r) => a + r.length, 0);
fs.writeFileSync('lib/israelLand.js', `// קו החוף של ישראל והסביבה (Natural Earth, דרך world-atlas), מפושט, למפה הקבועה במסך "מעליי"\nexport const LAND = ${JSON.stringify(rings)};\n`);
console.log('rings', rings.length, 'points', pts, 'bytes', fs.statSync('lib/israelLand.js').size);
