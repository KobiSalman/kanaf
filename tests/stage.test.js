import { describe, it, expect } from 'vitest';
import { flightStage } from '../lib/stageLogic.js';

const now = Date.parse('2026-11-27T12:00:00Z');
const H = 3600e3;

describe('שלב הטיסה', () => {
  it('נוסע: מוקדם, היום, בשדה, בטיסה, נחת', () => {
    expect(flightStage({ depAt: now + 30 * H }, now)).toBe('early');
    expect(flightStage({ depAt: now + 6 * H }, now)).toBe('today');
    expect(flightStage({ depAt: now + 2 * H }, now)).toBe('airport');
    expect(flightStage({ depAt: now - H, departed: true }, now)).toBe('air');
    expect(flightStage({ depAt: now - 5 * H, departed: true, landed: true }, now)).toBe('landed');
  });
  it('מי שמחכה בישראל: לפני, בטיסה, נחתה', () => {
    expect(flightStage({ arrivingTLV: true, depAt: now + 2 * H }, now)).toBe('before');
    expect(flightStage({ arrivingTLV: true, departed: true }, now)).toBe('air');
    expect(flightStage({ arrivingTLV: true, departed: true, landed: true }, now)).toBe('landed');
  });
  it('ביטול גובר על הכול', () => expect(flightStage({ depAt: now + 2 * H, cancelled: true }, now)).toBe('cancelled'));
});
