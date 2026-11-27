// מאפשר להוסיף את כנף למסך הבית ולפתוח אותה כמו אפליקציה, בלי חנות אפליקציות
export default function manifest() {
  return {
    name: 'כנף · מלווה הטיסה שלך',
    short_name: 'כנף',
    description: 'מעקב טיסות מנתב״ג: מתי להיות בשדה, מיקום המטוס, ומידע על היעד',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'he',
    background_color: '#EAF6FF',
    theme_color: '#6EC6FF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
