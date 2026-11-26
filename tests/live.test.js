import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockFetch, il } from './helpers';

beforeEach(() => vi.resetModules());

describe('הערכת מיקום כשאין קליטה', () => {
  it('לאבו דאבי, באמצע הדרך: בערך מעל סעודיה', async () => {
    const { estimatePosition } = await import('../lib/adsb.js');
    const dep = il('2026-11-26T19:15:00'), eta = il('2026-11-26T22:27:00');
    const e = estimatePosition({ from: 'TLV', to: 'AUH', depMs: dep, etaMs: eta, now: (dep + eta) / 2 });
    expect(e.view.over.code).toBe('SA');
  });
  it('לבנגקוק: המסלול הקצר עובר מעל עיראק/איראן, ושם לא מציגים הערכה', async () => {
    const { estimatePosition } = await import('../lib/adsb.js');
    const dep = il('2026-11-26T21:42:00'), eta = Date.parse('2026-11-27T05:06:00Z');
    expect(estimatePosition({ from: 'TLV', to: 'BKK', depMs: dep, etaMs: eta, now: dep + 2 * 3600e3 })).toBeNull();
  });
  it('בדקות הראשונות אחרי ההמראה: אין הערכה', async () => {
    const { estimatePosition } = await import('../lib/adsb.js');
    const dep = il('2026-11-26T19:15:00');
    expect(estimatePosition({ from: 'TLV', to: 'AUH', depMs: dep, etaMs: dep + 3 * 3600e3, now: dep + 5 * 60e3 })).toBeNull();
  });
});

describe('איתור המטוס', () => {
  const plane = (o) => ({ hex: o.hex, flight: o.flight + ' ', r: o.r || 'X', t: 'A320', lat: o.lat, lon: o.lon, alt_baro: o.alt ?? 36000, gs: 450, track: o.track, baro_rate: 0 });

  it('ELY83 לא משודר, אבל ELY083 כן: מוצאים לפי הגרסה עם האפסים', async () => {
    mockFetch({ adsb: (p) => (p === '/v2/callsign/ELY083' ? { ac: [plane({ hex: 'a1', flight: 'ELY083', lat: 25, lon: 50, track: 120 })] } : { ac: [] }) });
    const { lookupLive } = await import('../lib/adsb.js');
    const r = await lookupLive({ callsign: 'ELY83' });
    expect(r.found).toBe(true);
  });
  it('שיתוף קוד: מוצאים לפי אות הקריאה של החברה המפעילה', async () => {
    mockFetch({ adsb: (p) => (p === '/v2/callsign/ETD598' ? { ac: [plane({ hex: 'b1', flight: 'ETD598', lat: 27, lon: 45, track: 120 })] } : { ac: [] }) });
    const { lookupLive } = await import('../lib/adsb.js');
    const r = await lookupLive({ callsign: 'ELY9607', cs: ['ETD598'] });
    expect(r.found).toBe(true);
    expect(r.broadcastCallsign).toBe('ETD598');
  });
  it('וויז לפי מסלול: בוחרים את המטוס שטס לבודפשט, גם כששעת ההמראה בלוח לא מדויקת', async () => {
    const now = Date.now();
    // לפי הלוח: המריא לפני 95 דקות. בפועל המטוס רק ליד חוף מצרים (התחיל מאוחר יותר)
    const depMs = now - 95 * 60e3, etaMs = now + 120 * 60e3;
    mockFetch({ adsb: (p) => (p.startsWith('/v2/point/') ? { ac: [
      plane({ hex: 'w1', flight: 'WZZ178N', lat: 33.5, lon: 30.6, track: 318 }),   // בדרך לבודפשט
      plane({ hex: 'w2', flight: 'WZZ51AB', lat: 33.0, lon: 31.0, track: 200 }),   // טס דרומה, לא לבודפשט
      plane({ hex: 'e1', flight: 'ELY2367', lat: 33.4, lon: 30.9, track: 318 })    // אות קריאה מספרי של טיסה אחרת
    ] } : { ac: [] }) });
    const { lookupLive } = await import('../lib/adsb.js');
    const r = await lookupLive({ callsign: 'WZZ2328', from: 'TLV', to: 'BUD', direction: 'departure', depMs, etaMs });
    expect(r.found).toBe(true);
    expect(r.broadcastCallsign).toBe('WZZ178N');
    expect(r.matchedByRoute).toBe(true);
  });
  it('מטוס אחר שמשדר את הרישום שלנו בטיסה אחרת: לא מציגים אותו', async () => {
    mockFetch({ adsb: (p) => (p.startsWith('/v2/registration/') ? { ac: [plane({ hex: 'c1', flight: 'ELY316', r: '4X-EKA', lat: 32, lon: 34.9, track: 90 })] } : { ac: [] }) });
    const { lookupLive } = await import('../lib/adsb.js');
    const r = await lookupLive({ callsign: 'ELY315', reg: '4X-EKA' });
    expect(r.found).toBe(false);
  });
});
