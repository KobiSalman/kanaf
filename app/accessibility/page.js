import Link from 'next/link';
import { BrandBar } from '../Logo';

export const metadata = {
  title: 'הצהרת נגישות · כנף',
  description: 'הנגישות של כנף לאנשים עם מוגבלות, מה הותאם, מגבלות ידועות ואיך פונים אלינו'
};

const UPDATED = 'נובמבר 2026';

function Section({ title, children }) {
  return (
    <section className="card" style={{ gap: 8 }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function Accessibility() {
  return (
    <>
      <BrandBar />
      <main className="app" style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
        <Link href="/" className="small" style={{ color: 'inherit' }}>→ חזרה לכנף</Link>
        <h1 style={{ margin: '4px 0 0', fontSize: 24 }}>הצהרת נגישות</h1>
        <p className="small muted" style={{ margin: 0 }}>עודכנה לאחרונה: {UPDATED}</p>

        <Section title="המחויבות שלנו">
          <p style={{ margin: 0 }}>אנחנו רוצים שכל אחד ואחת יוכלו להשתמש בכנף, כולל אנשים עם מוגבלות. כנף נבנתה מתוך מטרה לעמוד בהנחיות הנגישות לתכני אינטרנט WCAG 2.0 ברמה AA, שעליהן מבוסס התקן הישראלי ת״י 5568.</p>
        </Section>

        <Section title="מה עשינו">
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>האתר כתוב בעברית, מימין לשמאל, עם הגדרת שפה מתאימה לקוראי מסך.</li>
            <li>כל הכפתורים והקישורים זמינים גם במקלדת, עם מסגרת ברורה סביב הפריט שנבחר.</li>
            <li>לתמונות, ללוגואים ולאייקונים יש תיאור טקסטואלי, ואייקונים שהם קישוט בלבד מוסתרים מקוראי מסך.</li>
            <li>ניגודיות הצבעים בטקסטים ובכפתורים נבדקה מול דרישות רמה AA.</li>
            <li>אפשר להגדיל את הטקסט בדפדפן או בטלפון בלי שהתוכן יישבר.</li>
            <li>מי שביקש במכשיר להפחית תנועה, יראה את האתר כמעט בלי אנימציות.</li>
            <li>עדכונים חשובים, כמו שינוי בטיסה, מוכרזים גם לקוראי מסך.</li>
            <li>בדקנו את המסכים העיקריים בכלי בדיקה אוטומטי (axe) ותיקנו את הבעיות שנמצאו.</li>
          </ul>
        </Section>

        <Section title="מגבלות ידועות">
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>המפות (מטוסים מעליך ומסלול הטיסה) הן תמונה. המידע החשוב שבהן מופיע גם כטקסט, למשל מעל איזו מדינה המטוס ומתי הוא נוחת.</li>
            <li>לוגואים של חברות תעופה ותמונות מטוסים מגיעים מאתרים חיצוניים, ולפעמים חסר בהם תיאור מפורט.</li>
            <li>כנף עדיין בהרצה, וייתכן שנשארו מקומות שלא הותאמו במלואם. נשמח לשמוע עליהם.</li>
          </ul>
        </Section>

        <Section title="נתקלתם בבעיית נגישות?">
          <p style={{ margin: 0 }}>אפשר לפנות אלינו דרך הכפתור "בהרצה · דווח על בעיה" שבראש כל עמוד. כתבו מה ניסיתם לעשות ומה לא עבד, ואם תרצו שנחזור אליכם, השאירו מייל. נשתדל לטפל בכל פנייה בהקדם.</p>
        </Section>

        <Link href="/terms" className="small" style={{ color: 'inherit', marginTop: 8 }}>תנאי שימוש ופרטיות</Link>
      </main>
    </>
  );
}
