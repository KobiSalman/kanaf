// "מעל איפה אנחנו" ו"מה רואים מהחלון" – הכול מחושב בשרת, בלי שירות חיצוני.
import { iso1A2Code } from '@rapideditor/country-coder';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';
import land50 from 'world-atlas/land-50m.json';
import { heT } from './i18n';

const LAND = feature(land50, land50.objects.land);
const HE = new Intl.DisplayNames(['he'], { type: 'region' });
const NAMES = {};
const regionName = (code, lang) => {
  try {
    NAMES[lang] = NAMES[lang] || new Intl.DisplayNames([lang], { type: 'region' });
    return NAMES[lang].of(code);
  } catch { return null; }
};

// אזורי ים בקירוב (מלבנים), לפי הסדר: הספציפי לפני הכללי
const SEAS = [
  ['ים סוף', 12, 30, 32, 44],
  ['המפרץ הפרסי', 23.5, 30.5, 47.5, 57],
  ['הים השחור', 40.8, 46.8, 27.3, 41.8],
  ['הים הכספי', 36.5, 47.5, 46.5, 55],
  ['הים האגאי', 35.2, 41, 22.5, 28.3],
  ['הים האדריאטי', 39.8, 45.8, 12, 20],
  ['הים היוני', 36, 40, 15.5, 22.5],
  ['הים הטירני', 37.8, 44, 9.5, 16],
  ['תעלת למאנש', 49.2, 51.2, -5.5, 2],
  ['הים הצפוני', 51, 61, -4, 9],
  ['הים הבלטי', 53.5, 66, 9.5, 30],
  ['מפרץ ביסקאי', 43.3, 48, -8, -1],
  ['הים התיכון', 30, 46, -6, 36.5],
  ['האוקיינוס האטלנטי', -60, 70, -80, -6]
];

// נקודות עניין שאפשר לראות מהחלון בקווים הנפוצים מישראל
const SIGHTS = [
  ['ים המלח', 31.5, 35.5], ['הכנרת', 32.82, 35.59], ['החרמון', 33.42, 35.86], ['חיפה ומפרץ חיפה', 32.79, 34.99],
  ['ירושלים', 31.78, 35.22], ['מפרץ אילת', 29.5, 34.95], ['הר סיני', 28.54, 33.97], ['דלתת הנילוס', 31.0, 31.0],
  ['קהיר והפירמידות', 29.98, 31.13], ['הרי טרודוס בקפריסין', 34.94, 32.86], ['לרנקה', 34.92, 33.63],
  ['הר אידה בכרתים', 35.23, 24.77], ['רודוס', 36.17, 27.92], ['סנטוריני', 36.4, 25.43], ['אתונה', 37.98, 23.73],
  ['הר האולימפוס', 40.09, 22.36], ['סלוניקי', 40.64, 22.94], ['איסטנבול והבוספורוס', 41.04, 29.0], ['קפדוקיה', 38.64, 34.83],
  ['אנטליה', 36.9, 30.7], ['מלטה', 35.9, 14.4], ['הר אטנה', 37.75, 14.99], ['הר וזוב ומפרץ נאפולי', 40.82, 14.43],
  ['רומא', 41.9, 12.5], ['ונציה', 45.44, 12.33], ['קורסיקה', 42.15, 9.1], ['סרדיניה', 40.1, 9.0], ['מיורקה', 39.6, 2.95],
  ['מון בלאן', 45.83, 6.86], ['המטרהורן', 45.98, 7.66], ['אגם ז׳נבה', 46.45, 6.55], ['אגם גארדה', 45.6, 10.65],
  ['ציריך', 47.37, 8.54], ['גרוסגלוקנר באלפים האוסטריים', 47.07, 12.69], ['וינה', 48.21, 16.37],
  ['בודפשט והדנובה', 47.5, 19.04], ['אגם בלטון', 46.83, 17.73], ['פראג', 50.08, 14.42], ['מינכן', 48.14, 11.58],
  ['ברלין', 52.52, 13.4], ['פריז', 48.86, 2.35], ['לונדון', 51.51, -0.13], ['צוקי דובר', 51.13, 1.33],
  ['אמסטרדם', 52.37, 4.9], ['הפירנאים', 42.67, 0.6], ['ברצלונה', 41.39, 2.17], ['מדריד', 40.42, -3.7],
  ['הר אלברוס בקווקז', 43.35, 42.44], ['דובאי', 25.2, 55.27], ['ניו יורק', 40.71, -74.0]
];

const R = 6371, rad = Math.PI / 180;

function destination(lat, lon, bearingDeg, km) {
  const d = km / R, b = bearingDeg * rad, p1 = lat * rad, l1 = lon * rad;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / rad, ((l2 / rad + 540) % 360) - 180];
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function placeAt(lat, lon) {
  if (geoContains(LAND, [lon, lat])) {
    const code = iso1A2Code([lon, lat]);
    let name = null;
    try { name = code ? HE.of(code) : null; } catch {}
    return { kind: 'land', name: name || 'יבשה', code: code || null };
  }
  const sea = SEAS.find(([, a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
  return { kind: 'sea', name: sea ? sea[0] : 'הים' };
}

export function windowView({ latitude, longitude, direction, altitudeM }) {
  const over = placeAt(latitude, longitude);
  const visibleKm = Math.min(250, 3.57 * Math.sqrt(Math.max(altitudeM, 0)));
  const side = (offset) => {
    const near = destination(latitude, longitude, direction + offset, Math.min(60, visibleKm / 2));
    const sights = SIGHTS.map(([name, la, lo]) => {
      const km = distanceKm(latitude, longitude, la, lo);
      const rel = ((bearing(latitude, longitude, la, lo) - direction + 540) % 360) - 180;
      return { name, km: Math.round(km), rel };
    })
      .filter((s) => s.km <= visibleKm && (offset < 0 ? s.rel <= -30 && s.rel >= -150 : s.rel >= 30 && s.rel <= 150))
      .sort((a, b) => a.km - b.km)
      .slice(0, 2)
      .map(({ name, km }) => ({ name, km }));
    return { area: placeAt(near[0], near[1]), sights };
  };
  return { over, visibleKm: Math.round(visibleKm), left: side(-90), right: side(90) };
}

// השמות נשמרים במטמון בעברית. לפני ששולחים לדפדפן בשפה אחרת, מתרגמים אותם (מדינה לפי הקוד שלה)
const place = (p, t) => {
  if (!p) return p;
  const name = p.kind === 'land' && p.code ? regionName(p.code, t.lang) || t.raw(p.name) : t.raw(p.name);
  return { ...p, name };
};
export function localizeView(view, t = heT) {
  if (!view || t.lang === 'he') return view;
  const side = (s) => (s ? { ...s, area: place(s.area, t), sights: (s.sights || []).map((x) => ({ ...x, name: t.raw(x.name) })) } : s);
  return { ...view, over: place(view.over, t), left: side(view.left), right: side(view.right) };
}

// כל השמות בקובץ, לבדיקה שיש לכולם תרגום
export const GEO_NAMES = [...SEAS.map((x) => x[0]), ...SIGHTS.map((x) => x[0]), 'יבשה', 'הים'];
