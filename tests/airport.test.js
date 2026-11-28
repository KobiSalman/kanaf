import { describe, it, expect } from 'vitest';
import { leaveTarget, pickupTarget, levelOf, checkinLoad, queueEstimate, terminalLoad } from '../lib/airportLogic.js';
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

describe('זמן המתנה משוער בבידוק', () => {
  const H = 3600e3, t0 = Date.UTC(2026, 10, 29, 6);
  const crowd = (t3, t1 = 0) => ({ hours: Array.from({ length: 8 }, (_, i) => ({ t: t0 + i * H, dep: t3 + t1, arr: 0, term: { 3: t3, 1: t1 } })) });
  it('סופר רק את הטרמינל של הנוסע', () => {
    expect(terminalLoad(crowd(14, 2), t0, '3')).toBe(14);
    expect(terminalLoad(crowd(14, 2), t0, '1')).toBe(2);
  });
  it('שעה רגועה: בידוק קצר', () => {
    const q = queueEstimate(crowd(2), t0, { term: '3' });
    expect(q.security[1]).toBeLessThanOrEqual(15);
  });
  it('עמוס: בערך 30 עד 45 דקות בבידוק', () => {
    const q = queueEstimate(crowd(14), t0, { term: '3' });
    expect(q.security[0]).toBeGreaterThanOrEqual(25);
    expect(q.security[1]).toBeLessThanOrEqual(45);
    expect(q.total[0]).toBeLessThan(q.total[1]);
  });
  it('טרמינל 1: פחות טיסות כבר נחשבות עומס', () => {
    expect(queueEstimate(crowd(0, 6), t0, { term: '1' }).security[0]).toBe(queueEstimate(crowd(14), t0, { term: '3' }).security[0]);
  });
  it('טיסה פנימית: בלי ביקורת דרכונים', () => expect(queueEstimate(crowd(5), t0, { term: '3', domestic: true }).passport).toBeNull());
  it('בלי לוח: אין הערכה', () => expect(queueEstimate(null, t0, { term: '3' })).toBeNull());
});
