import { describe, it, expect } from 'vitest';
import { codeStrings, dataStrings } from '../scripts/i18n-keys.mjs';
import EN from '../locales/en.json';
import EN_DATA from '../locales/en.data.json';
import { makeT, heT, pathFor, splitPath } from '../lib/i18n.js';
import { getT } from '../lib/i18nServer.js';
import { minutesLabel, agoLabel } from '../lib/time.js';
import { delayStamp } from '../lib/flightLogic.js';
import { plugInfo, diffLabel } from '../lib/destLogic.js';
import { localizeFlight, statusText } from '../lib/localize.js';

const vars = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');
const DICT = { ...EN_DATA, ...EN };

describe('מילון אנגלית', () => {
  const { keys, problems } = codeStrings();
  it('אין טקסט בעברית שלא עובר דרך tr()', () => expect(problems).toEqual([]));
  it('לכל משפט בקוד יש תרגום', () => expect([...keys.keys()].filter((k) => !DICT[k])).toEqual([]));
  it('לכל משפט בקובצי הנתונים יש תרגום', () => expect([...dataStrings()].filter((k) => !DICT[k])).toEqual([]));
  it('המשתנים בתרגום זהים למקור', () => {
    const bad = Object.entries(DICT).filter(([he, en]) => vars(he) !== vars(en));
    expect(bad).toEqual([]);
  });
  it('אין עברית בתרגום (חוץ ממעבר השפה)', () => {
    const bad = Object.entries(DICT).filter(([he, en]) => /[֐-׿]/.test(en) && he !== en);
    expect(bad).toEqual([]);
  });
});

describe('t()', () => {
  const en = getT('en');
  it('עברית נשארת עברית', () => expect(heT('עודכן לפני {n} דק׳', { n: 3 })).toBe('עודכן לפני 3 דק׳'));
  it('אנגלית מתורגמת עם משתנים', () => expect(en('עודכן לפני {n} דק׳', { n: 3 })).toBe('Updated 3 min ago'));
  it('משפט בלי תרגום נשאר כמו שהוא', () => expect(makeT('en', {})('שלום')).toBe('שלום'));
  it('רכיב בתוך משפט מחזיר מערך', () => expect(Array.isArray(makeT('en', {})('a {x} b', { x: { type: 'b', props: {} } }))).toBe(true));
  it('כתובות לפי שפה', () => {
    expect(pathFor('en', '/terms')).toBe('/en/terms');
    expect(pathFor('he', '/terms')).toBe('/terms');
    expect(pathFor('en', '/')).toBe('/en');
    expect(splitPath('/en/flight/LY1')).toEqual({ lang: 'en', path: '/flight/LY1' });
    expect(splitPath('/en')).toEqual({ lang: 'en', path: '/' });
    expect(splitPath('/entry')).toEqual({ lang: 'he', path: '/entry' });
  });
  it('פונקציות ב-lib באנגלית', () => {
    expect(minutesLabel(75, en)).toBe('1:15 h');
    expect(agoLabel(5000, en)).toBe('Updated just now');
    expect(plugInfo('G', en).text).toMatch('British');
    expect(diffLabel('Asia/Jerusalem', en)).toBe('Same time as Israel');
    expect(delayStamp({ status: 'cancelled', departure: {}, arrival: {} }, en).title).toBe('Cancelled');
  });
  it('טיסה מהלוח באנגלית', () => {
    const f = { airline: 'אל על', airlineEn: 'El Al Israel Airlines', statusHe: 'בזמן', statusEn: 'ON TIME',
      departure: { iata: 'TLV', cityHe: 'תל אביב', cityEn: 'Tel Aviv', airport: 'נתב״ג' },
      arrival: { iata: 'JFK', cityHe: 'ניו יורק', cityEn: 'New York', countryHe: 'ארצות הברית', countryEn: 'UNITED STATES' } };
    const x = localizeFlight(f, en);
    expect([x.airline, x.statusHe, x.arrival.cityHe, x.arrival.countryHe, x.departure.airport]).toEqual(['El Al', 'On time', 'New York', 'United States', 'Ben Gurion Airport']);
    expect(localizeFlight(f, heT)).toBe(f);
    expect(statusText('DELAYED', 'עיכוב', en)).toBe('Delayed');
  });
});
