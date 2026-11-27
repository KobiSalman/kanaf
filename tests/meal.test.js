import { describe, it, expect } from 'vitest';
import { mealInfo } from '../lib/mealLogic.js';

describe('אוכל בטיסה', () => {
  it('אל על: כלול גם בכרטיס Lite', () => expect(mealInfo('LY', 270).kind).toBe('included'));
  it('וויז: לואו-קוסט, בתשלום', () => expect(mealInfo('W6', 180).kind).toBe('paid'));
  it('ישראייר לאירופה: בתשלום', () => expect(mealInfo('6H', 200).kind).toBe('paid'));
  it('לופטהנזה קצר: חטיף כלול, ארוך: ארוחה כלולה', () => {
    expect(mealInfo('LH', 240).kind).toBe('snack');
    expect(mealInfo('LH', 660).kind).toBe('included');
  });
  it('חברה לא מוכרת: "תלוי בכרטיס", ומסומן כהערכה', () => {
    const m = mealInfo('XX', 200);
    expect(m.kind).toBe('depends');
    expect(m.known).toBe(false);
  });
  it('שיתוף קוד: קובעת החברה המפעילה (IB7716 = אל על)', () => expect(mealInfo('LY', 300).kind).toBe('included'));
});
