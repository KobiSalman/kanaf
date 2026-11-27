// באיזה שלב הטיסה נמצאת, כדי להציג בראש המסך רק את מה שחשוב עכשיו
const H = 3600e3;

// passenger: טיסה שממריאה (או לא קשורה לנתב״ג). waiting: טיסה שנוחתת בנתב״ג, למי שמחכה
export function flightStage({ arrivingTLV, depAt, departed, landed, cancelled }, now) {
  if (cancelled) return 'cancelled';
  if (landed) return 'landed';
  if (departed) return 'air';
  if (arrivingTLV) return 'before';
  if (!depAt) return 'today';
  if (depAt - now > 24 * H) return 'early';
  if (depAt - now > 3 * H) return 'today';
  return 'airport';
}

// עלייה למטוס: כ-40 דקות לפני ההמראה
export function boardingAt(depAt) {
  return depAt ? depAt - 40 * 60e3 : null;
}
