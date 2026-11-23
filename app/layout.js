import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata = {
  title: 'כנף · מלווה טיסה',
  description: 'כל המידע על הטיסה שלך, לפני ובזמן הטיסה'
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
      <body>{children}</body>
    </html>
  );
}
