import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { I18nProvider } from './i18n';
import { DIR, OG_LOCALE } from '../lib/i18n';
import { dictFor, getT } from '../lib/i18nServer';
import { pageLang } from '../lib/pageLang';

export function generateMetadata() {
  const lang = pageLang();
  const t = getT(lang);
  return {
    metadataBase: new URL('https://kanaf-seven.vercel.app'),
    title: t('כנף · מלווה טיסה'),
    description: t('כל המידע על הטיסה שלך, לפני ובזמן הטיסה'),
    // ברירת מחדל לכל העמודים: שם האתר ותמונת השיתוף (עמוד שיש לו תמונה משלו גובר)
    openGraph: { siteName: t('כנף'), locale: OG_LOCALE[lang], type: 'website', images: [{ url: t.lang === 'he' ? '/api/og' : `/api/og?lang=${t.lang}`, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', images: [t.lang === 'he' ? '/api/og' : `/api/og?lang=${t.lang}`] },
    // באייפון, אחרי "הוסף למסך הבית": נפתח במסך מלא, עם השם כנף
    appleWebApp: { capable: true, title: t('כנף'), statusBarStyle: 'default' },
    // אימות הבעלות ב-Google Search Console
    verification: { google: '0zm4MSLy2bvp3TUb0mlnWywi6Cg54fhJEihJyBxi7lI' }
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6EC6FF'
};

export default function RootLayout({ children }) {
  const lang = pageLang();
  return (
    <html lang={lang} dir={DIR[lang]}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800&display=swap" />
      </head>
      <body>
        <I18nProvider lang={lang} dict={dictFor(lang)}>{children}</I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
