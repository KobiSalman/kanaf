import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockFetch } from './helpers';

let iaa, logic;
beforeEach(async () => {
  vi.resetModules();
  mockFetch({ extraRows: [{ CHOPER: 'LY', CHFLTN: '0691A', CHOPERD: 'EL AL ISRAEL AIRLINES', CHSTOL: '2026-11-26T10:00:00', CHPTOL: '2026-11-26T10:00:00', CHAORD: 'D', CHLOC1: 'ATH', CHLOC1D: 'ATHENS', CHLOC1TH: 'אתונה', CHLOC1T: 'ATHENS', CHLOC1CH: 'יוון', CHLOCCT: 'GREECE', CHTERM: 3, CHCINT: null, CHCKZN: null, CHRMINE: 'DEPARTED', CHRMINH: 'המריאה' }] });
  iaa = await import('../lib/iaa.js');
  logic = await import('../lib/flightLogic.js');
});

describe('פענוח מספרי טיסה', () => {
  it('קוד ICAO, קוד IATA עם ספרה, ואפסים מובילים', () => {
    expect(iaa.parseFlight('ELY083')).toMatchObject({ airline: 'LY', number: 83 });
    expect(iaa.parseFlight('W62328')).toMatchObject({ airline: 'W6', number: 2328 });
    expect(iaa.parseFlight('6H891')).toMatchObject({ airline: '6H', number: 891 });
  });
  it('מספר טיסה עם אות בסוף (0691A) לא נשבר', async () => {
    const r = await iaa.iaaFlight('LY691A', '2026-11-26');
    expect(r.flight.flight).toBe('LY691A');
    expect(r.flight.callsign).toBe('ELY691A');
  });
});

describe('חותמת עיכוב', () => {
  it('W62328: הלוח כותב בזמן, אבל השעה זזה בשעתיים, ולכן יש עיכוב', async () => {
    const { flight } = await iaa.iaaFlight('W62328', '2026-11-26');
    expect(flight.departure.delay).toBeGreaterThanOrEqual(15);
    expect(logic.delayStamp(flight).title).toBe('עיכוב');
  });
  it('טיסה שבוטלה מקבלת חותמת "בוטלה" (כמו BZ442 ב-28/11)', () => {
    const f = { status: 'cancelled', statusEn: 'CANCELED', direction: 'departure', departure: { delay: null }, arrival: {} };
    expect(logic.delayStamp(f).title).toBe('בוטלה');
  });
  it('בלי עיכוב: אין חותמת', () => {
    const f = { status: 'scheduled', statusEn: 'ON TIME', direction: 'departure', departure: { delay: 5 }, arrival: {} };
    expect(logic.delayStamp(f)).toBeNull();
  });
});

describe('שיתוף קוד', () => {
  it('TG4586 בלי אות קריאה משלה: מוצאים את LY83 של אל על, והיא המפעילה', async () => {
    const { flight } = await iaa.iaaFlight('TG4586', '2026-11-26');
    expect(flight.callsign).toBeNull();
    expect(flight.codeshares.map((c) => c.callsign)).toContain('ELY83');
    const c = logic.codeshareInfo(flight);
    expect(c.op.flight).toBe('LY83');
    expect(c.certain).toBe(false);
    expect(logic.codeshareInfo({ ...flight, broadcastCallsign: 'ELY83' }).certain).toBe(true);
  });
  it('LY9607: המפעילה היא אתיחאד EY598', async () => {
    const { flight } = await iaa.iaaFlight('LY9607', '2026-11-26');
    expect(logic.codeshareInfo(flight).op.flight).toBe('EY598');
    expect(flight.codeshares.map((c) => c.callsign)).toContain('ETD598');
  });
  it('IB7716 של איבריה היא בעצם LY397 של אל על', async () => {
    const r = (await iaa.iaaFlight('IB7716', '2026-11-26'));
    const c = logic.codeshareInfo(r.flight);
    expect(c.op.flight).toBe('LY397');
    expect(c.op.own).toBeFalsy();
  });
  it('חברה עם ספרה בקוד (6H891) מזוהה נכון כמפעילה', () => {
    const f = { flight: '6H891', airlineIata: '6H', airline: 'ישראייר', callsign: 'ISR891', codeshares: [{ flight: 'XY4891', iata: 'XY', fn: 4891, callsign: null }] };
    expect(logic.codeshareInfo(f).op.own).toBe(true);
  });
  it('טיסה בלי שיתוף קוד: אין כרטיס', async () => {
    const { flight } = await iaa.iaaFlight('W62328', '2026-11-26');
    expect(logic.codeshareInfo(flight)).toBeNull();
  });
});

describe('טיסה נכנסת שממריאה ביום אחד ונוחתת למחרת', () => {
  const row = (stol, st) => ({ CHOPER: 'UA', CHFLTN: '0090', CHOPERD: 'UNITED AIRLINES', CHSTOL: stol, CHPTOL: stol, CHAORD: 'A', CHLOC1: 'EWR', CHLOC1D: 'NEWARK', CHLOC1TH: 'ניו יורק', CHLOC1T: 'NEW YORK', CHLOC1CH: 'ארצות הברית', CHLOCCT: 'UNITED STATES', CHTERM: 3, CHCINT: null, CHCKZN: null, CHRMINE: st, CHRMINH: '' });
  beforeEach(async () => {
    vi.resetModules();
    mockFetch({ extraRows: [row('2026-11-27T17:00:00', 'LANDING'), row('2026-11-28T17:00:00', 'NOT FINAL')] });
    iaa = await import('../lib/iaa.js');
  });
  it('UA90 ב-27/11: מקבלים את זו שנוחתת היום ב-17:00, לא את זו שממריאה הלילה', async () => {
    const { flight } = await iaa.iaaFlight('UA90', '2026-11-27');
    expect(flight.arrival.scheduled).toBe('2026-11-27T17:00:00');
    expect(flight.date).toBe('2026-11-26');
  });
  it('לפי תאריך ההמראה (26/11) מקבלים את אותה טיסה, ו-28/11 נותן את של מחר', async () => {
    expect((await iaa.iaaFlight('UA90', '2026-11-26')).flight.arrival.scheduled).toBe('2026-11-27T17:00:00');
    expect((await iaa.iaaFlight('UA90', '2026-11-28')).flight.arrival.scheduled).toBe('2026-11-28T17:00:00');
  });
});
