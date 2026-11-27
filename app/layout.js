import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  metadataBase: new URL('https://kanaf-seven.vercel.app'),
  title: 'כנף · מלווה טיסה',
  description: 'כל המידע על הטיסה שלך, לפני ובזמן הטיסה',
  // ברירת מחדל לכל העמודים: שם האתר ותמונת השיתוף (עמוד שיש לו תמונה משלו גובר)
  openGraph: { siteName: 'כנף', locale: 'he_IL', type: 'website', images: [{ url: '/api/og', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/api/og'] },
  // באייפון, אחרי "הוסף למסך הבית": נפתח במסך מלא, עם השם כנף
  appleWebApp: { capable: true, title: 'כנף', statusBarStyle: 'default' },
  // אימות הבעלות ב-Google Search Console
  verification: { google: '0zm4MSLy2bvp3TUb0mlnWywi6Cg54fhJEihJyBxi7lI' }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6EC6FF'
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800&display=swap" />
      </head>
      <body>{children}<Analytics /></body>
    </html>
  );
}
