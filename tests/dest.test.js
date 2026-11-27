import { describe, it, expect } from 'vitest';
import { plugInfo, diffLabel, offsetMin } from '../lib/destLogic.js';
import INFO from '../data/destinations-info.json';
import TRANSPORT from '../data/airport-transport.json';

describe('שקע חשמל במילים', () => {
  it('אירופה: התקע הישראלי נכנס', () => expect(plugInfo('C, F').fits).toBe(true));
  it('בריטניה: צריך מתאם בריטי', () => expect(plugInfo('G').text).toMatch('בריטי'));
  it('ארה״ב: מתאם אמריקאי והסבר על המתח', () => {
    const p = plugInfo('A, B (מתח 120V)');
    expect(p.fits).toBe(false);
    expect(p.text).toMatch('אמריקאי');
    expect(p.text).toMatch('המתח');
  });
  it('לכל מדינה יש תיאור שקע שמובן', () => {
    for (const [k, c] of Object.entries(INFO.countries)) expect(plugInfo(c.plugs).short, k).toBeTruthy();
  });
});

describe('הפרש שעות', () => {
  it('לונדון בנובמבר: שעתיים אחורה', () => {
    const nov = Date.parse('2026-11-26T12:00:00Z');
    expect((offsetMin('Europe/London', nov) - offsetMin('Asia/Jerusalem', nov)) / 60).toBe(-2);
  });
  it('אותו אזור זמן', () => expect(diffLabel('Asia/Jerusalem')).toBe('אותה שעה כמו בישראל'));
});

describe('שלמות הנתונים', () => {
  it('לכל מדינה: שפה, מטבע, בירה, מאכלים, עובדה ודגל', () => {
    for (const [k, c] of Object.entries(INFO.countries)) {
      expect(c.lang && c.currency?.code && c.capital && c.foods?.length >= 3 && c.fact && c.iso, k).toBeTruthy();
    }
  });
  it('לכל שדה בדרכי ההגעה: לפחות דרך אחת ואפליקציה אחת', () => {
    for (const [k, t] of Object.entries(TRANSPORT.airports)) expect(t.transit.length > 0 && t.apps.length > 0, k).toBe(true);
  });
});

describe('יעדים חדשים', () => {
  it('ארגנטינה: שקע I, צריך מתאם', () => expect(plugInfo('I (מתח 220V)').short).toBe('צריך מתאם'));
});
