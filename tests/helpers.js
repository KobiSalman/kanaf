import { vi } from 'vitest';
import BOARD from './fixtures/iaa-2026-11-26.json';

// מחליף את fetch: לוח נתב״ג מהקובץ ששמרנו, ותשובות adsb.lol לפי מה שהבדיקה מגדירה
export function mockFetch({ extraRows = [], adsb = () => ({ ac: [] }) } = {}) {
  const rows = [...BOARD, ...extraRows].map((r, i) => ({ _id: i, ...r }));
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('data.gov.il')) {
      const f = u.match(/filters=([^&]+)/);
      const filt = f ? JSON.parse(decodeURIComponent(f[1])) : null;
      const out = filt ? rows.filter((r) => Object.entries(filt).every(([k, v]) => r[k] === v)) : rows;
      return { ok: true, status: 200, json: async () => ({ success: true, result: { records: out } }) };
    }
    if (u.includes('api.adsb.lol')) {
      const path = u.replace('https://api.adsb.lol', '');
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => adsb(path) };
    }
    throw new Error('unexpected fetch ' + u);
  });
}

// שעה בישראל (נובמבר: UTC+2) -> רגע
export const il = (s) => Date.parse(s + '+02:00');
