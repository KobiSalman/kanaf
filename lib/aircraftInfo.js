import { heT } from './i18n';

// נתונים כלליים על דגמים נפוצים (לא על מטוס ספציפי).
// layout: תצורת מושבים טיפוסית במחלקת תיירים. החברות משנות אותה, לכן זה תרשים כללי בלבד.
export const TYPE_INFO = {
  B789: { lengthM: 62.8, spanM: 60.1, firstFlight: 2013, layout: '3-3-3', body: 'רחב גוף', fact: 'רוב גוף המטוס עשוי מחומרים מרוכבים, ולכן הלחות בתא גבוהה יותר והחלונות גדולים יותר משל מטוסים ותיקים.' },
  B788: { lengthM: 56.7, spanM: 60.1, firstFlight: 2009, layout: '3-3-3', body: 'רחב גוף', fact: 'הדרימליינר הראשון. החלונות שלו מוחשכים בכפתור, בלי וילון.' },
  B78X: { lengthM: 68.3, spanM: 60.1, firstFlight: 2017, layout: '3-3-3', body: 'רחב גוף', fact: 'הגרסה הארוכה של הדרימליינר.' },
  B738: { lengthM: 39.5, spanM: 35.8, firstFlight: 1997, layout: '3-3', body: 'צר גוף', fact: 'אחד ממטוסי הנוסעים הנפוצים בעולם.' },
  B739: { lengthM: 42.1, spanM: 35.8, firstFlight: 2000, layout: '3-3', body: 'צר גוף', fact: 'גרסה מוארכת של ה-737.' },
  B38M: { lengthM: 39.5, spanM: 35.9, firstFlight: 2016, layout: '3-3', body: 'צר גוף', fact: 'דור חדש של ה-737, עם מנועים חסכוניים יותר.' },
  B77W: { lengthM: 73.9, spanM: 64.8, firstFlight: 2003, layout: '3-4-3', body: 'רחב גוף', fact: 'המנועים שלו מהגדולים שהותקנו על מטוס נוסעים.' },
  B772: { lengthM: 63.7, spanM: 60.9, firstFlight: 1994, layout: '3-4-3', body: 'רחב גוף', fact: 'מטוס דו-מנועי לטווח ארוך.' },
  A320: { lengthM: 37.6, spanM: 35.8, firstFlight: 1987, layout: '3-3', body: 'צר גוף', fact: 'מטוס הנוסעים הראשון עם מערכת היגוי אלקטרונית (Fly-by-wire) מלאה.' },
  A20N: { lengthM: 37.6, spanM: 35.8, firstFlight: 2014, layout: '3-3', body: 'צר גוף', fact: 'גרסת ה-neo, עם מנועים חדשים וחסכוניים יותר.' },
  A321: { lengthM: 44.5, spanM: 35.8, firstFlight: 1993, layout: '3-3', body: 'צר גוף', fact: 'הגרסה הארוכה ממשפחת ה-A320.' },
  A21N: { lengthM: 44.5, spanM: 35.8, firstFlight: 2016, layout: '3-3', body: 'צר גוף', fact: 'גרסת ה-neo הארוכה, נפוצה מאוד בחברות לואו-קוסט.' },
  A359: { lengthM: 66.8, spanM: 64.75, firstFlight: 2013, layout: '3-3-3', body: 'רחב גוף', fact: 'המטוס המתקדם של איירבוס לטווח ארוך, עם גוף מחומרים מרוכבים.' },
  A333: { lengthM: 63.7, spanM: 60.3, firstFlight: 1992, layout: '2-4-2', body: 'רחב גוף', fact: 'בתצורה הנפוצה יש בצדדים רק שני מושבים, כך שמהחלון קל לצאת.' },
  A388: { lengthM: 72.7, spanM: 79.8, firstFlight: 2005, layout: '3-4-3', body: 'רחב גוף, שתי קומות', fact: 'מטוס הנוסעים הגדול בעולם, עם שתי קומות לכל אורכו.' },
  E190: { lengthM: 36.2, spanM: 28.7, firstFlight: 2004, layout: '2-2', body: 'צר גוף', fact: 'אין בו מושב אמצעי: כל מושב הוא חלון או מעבר.' },
  E195: { lengthM: 38.7, spanM: 28.7, firstFlight: 2004, layout: '2-2', body: 'צר גוף', fact: 'אין בו מושב אמצעי: כל מושב הוא חלון או מעבר.' },
  BCS3: { lengthM: 38.7, spanM: 35.1, firstFlight: 2015, layout: '2-3', body: 'צר גוף', fact: 'החלונות בו גדולים במיוחד למטוס בגודל הזה.' }
};

// אותם נתונים, עם הטקסטים בשפה של המשתמש
export function typeInfo(type, t = heT) {
  const x = type ? TYPE_INFO[type] : null;
  return x ? { ...x, body: t.raw(x.body), fact: t.raw(x.fact) } : null;
}

const LETTERS = {
  '2-2': [['A', 'C'], ['D', 'F']],
  '2-3': [['A', 'C'], ['D', 'E', 'F']],
  '3-3': [['A', 'B', 'C'], ['D', 'E', 'F']],
  '2-4-2': [['A', 'C'], ['D', 'E', 'F', 'G'], ['H', 'K']],
  '3-3-3': [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'K']],
  '3-4-3': [['A', 'B', 'C'], ['D', 'E', 'F', 'G'], ['H', 'J', 'K']]
};

export function seatBlocks(layout) {
  return LETTERS[layout] || LETTERS['3-3'];
}

// מושב (למשל "32A") -> חלון שמאל / חלון ימין / מעבר / אמצע, לפי התצורה הטיפוסית
export function seatSide(seat, layout, t = heT) {
  const m = (seat || '').toUpperCase().match(/^(\d{1,2})([A-K])$/);
  if (!m) return null;
  const letter = m[2];
  const blocks = seatBlocks(layout);
  const first = blocks[0][0], last = blocks[blocks.length - 1].slice(-1)[0];
  if (letter === first) return { row: Number(m[1]), letter, kind: 'window', side: 'left', text: t('חלון בצד שמאל') };
  if (letter === last) return { row: Number(m[1]), letter, kind: 'window', side: 'right', text: t('חלון בצד ימין') };
  const aisle = blocks.some((b, i) => (i > 0 && b[0] === letter) || (i < blocks.length - 1 && b[b.length - 1] === letter));
  return { row: Number(m[1]), letter, kind: aisle ? 'aisle' : 'middle', side: null, text: aisle ? t('מושב מעבר') : t('מושב אמצעי') };
}
