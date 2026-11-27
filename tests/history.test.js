import { describe, it, expect } from 'vitest';
import { histEntry, summarize, historyText } from '../lib/history.js';

const row = (stol, ptol, st) => ({ op: 'W6', no: '2328', dir: 'D', stol, ptol, st });

describe('היסטוריית דיוק', () => {
  it('שומרים רק טיסות שהסתיימו, עם דקות העיכוב', () => {
    expect(histEntry(row('2026-11-26T06:40:00', '2026-11-26T08:40:00', 'DEPARTED'))).toEqual({ key: 'hist:W62328D', field: '2026-11-26', value: '120|D' });
    expect(histEntry(row('2026-11-26T06:40:00', '2026-11-26T06:40:00', 'ON TIME'))).toBeNull();
    expect(histEntry(row('2026-11-26T06:40:00', '2026-11-26T06:40:00', 'CANCELED')).value).toBe('0|X');
  });
  it('סיכום: בזמן, איחורים, ביטולים', () => {
    const h = summarize({ '2026-11-20': '5|D', '2026-11-21': '40|D', '2026-11-22': '0|X', '2026-11-23': '20|D', '2026-11-24': '0|D', '2026-11-25': '-3|D' }, { today: '2026-11-27' });
    expect(h).toMatchObject({ n: 6, onTime: 3, late: 2, cancelled: 1, avgLate: 30 });
    const t = historyText(h);
    expect(t.text).toMatch('3 מתוך 5');
    expect(t.text).toMatch('בממוצע 30');
  });
  it('פחות מ-5 טיסות: לא מציגים כלום', () => {
    expect(historyText(summarize({ '2026-11-25': '0|D' }, { today: '2026-11-27' }))).toBeNull();
  });
  it('טיסות ישנות מ-60 יום לא נספרות', () => {
    expect(summarize({ '2026-08-01': '0|D', '2026-11-25': '0|D' }, { today: '2026-11-27' }).n).toBe(1);
  });
});
