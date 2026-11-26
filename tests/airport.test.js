import { describe, it, expect } from 'vitest';
import { leaveTarget, pickupTarget, levelOf, checkinLoad } from '../lib/airportLogic.js';
import { il } from './helpers';

const crowdWith = (startIso, deps) => {
  const start = il(startIso);
  return { hours: deps.map((n, i) => ({ t: start + i * 3600e3, dep: n, arr: n })) };
};

describe('מתי להיות בשדה', () => {
  it('טיסה לחו״ל: 3 שעות לפני', () => {
    expect(leaveTarget({ arrival: { iata: 'BKK' } }, il('2026-11-26T21:30:00'), null)).toBe(il('2026-11-26T18:30:00'));
  });
  it('טיסה לאילת: שעתיים לפני', () => {
    expect(leaveTarget({ arrival: { iata: 'ETM' } }, il('2026-11-26T21:30:00'), null)).toBe(il('2026-11-26T19:30:00'));
  });
  it('צ׳ק-אין עמוס: עוד חצי שעה, ומעוגל לרבע שעה', () => {
    const crowd = crowdWith('2026-11-26T18:00:00', [20, 20, 20, 20, 20, 20, 20]);
    expect(levelOf(checkinLoad(crowd, il('2026-11-26T18:30:00'))).key).toBe('high');
    expect(leaveTarget({ arrival: { iata: 'FCO' } }, il('2026-11-26T21:30:00'), crowd)).toBe(il('2026-11-26T18:00:00'));
  });
});

describe('באים לאסוף', () => {
  it('נחיתה רגילה: הנוסע יוצא כחצי שעה אחרי, מעוגל ל-5 דקות', () => {
    expect(pickupTarget(il('2026-11-26T16:51:00'), null)).toBe(il('2026-11-26T17:25:00'));
  });
  it('הרבה נחיתות באותה שעה: עוד 20 דקות', () => {
    const crowd = crowdWith('2026-11-26T15:00:00', [15, 15, 15, 15]);
    expect(pickupTarget(il('2026-11-26T16:51:00'), crowd)).toBe(il('2026-11-26T17:45:00'));
  });
});

describe('רמות עומס', () => {
  it('ספים', () => {
    expect(levelOf(3).key).toBe('low');
    expect(levelOf(8).key).toBe('mid');
    expect(levelOf(14).key).toBe('high');
    expect(levelOf(null)).toBeNull();
  });
});
