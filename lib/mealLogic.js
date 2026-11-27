// "האם יש אוכל בטיסה?": לפי החברה המפעילה ואורך הטיסה
import MEALS from '../data/meals.json';

export const LONG_MIN = 300; // מעל 5 שעות נחשב טיסה ארוכה

export function mealInfo(iata, durationMin) {
  if (!iata) return null;
  const long = durationMin != null && durationMin >= LONG_MIN;
  const a = MEALS.airlines[iata];
  if (a) {
    const kind = (long && a.long) || a.short;
    return { kind, text: (long && a.longText) || a.text, known: true };
  }
  if (MEALS.lowcost.includes(iata)) {
    return { kind: 'paid', known: true, text: 'חברת לואו-קוסט: אוכל ושתייה לא כלולים. אפשר לקנות במטוס, או להביא אוכל מהבית (בבידוק מגבילים רק נוזלים).' };
  }
  return {
    kind: long ? 'included' : 'depends', known: false,
    text: long
      ? 'בטיסה ארוכה בחברה רגילה בדרך כלל מגישים ארוחה. בכרטיסים הזולים כדאי לוודא בהזמנה.'
      : 'בחברה רגילה בדרך כלל מגישים משהו, לפעמים רק חטיף. בכרטיסים הזולים (Basic/Light) לפעמים לא כלול, כדאי לבדוק בהזמנה.'
  };
}

export const MEAL_LABEL = { included: 'כלול', snack: 'חטיף כלול, ארוחה בתשלום', paid: 'בתשלום', depends: 'תלוי בכרטיס' };
