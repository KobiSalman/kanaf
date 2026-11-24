import { NextResponse } from 'next/server';
import { cacheGet, cacheSet } from '../../../lib/cache';

// תמונה אמיתית של המטוס לפי מספר הרישום, מ-Planespotters.net (API ציבורי).
// התנאים שלהם: להציג את שם הצלם ולקשר לעמוד התמונה באתר שלהם.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reg = (searchParams.get('reg') || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,10}$/.test(reg)) return NextResponse.json({ error: 'מספר רישום לא תקין' }, { status: 400 });

  const key = `photo:${reg}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached.value);

  let body = { found: false };
  try {
    const res = await fetch(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`, {
      headers: { 'User-Agent': 'kanaf-flight-companion/1.0' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const p = (data.photos || [])[0];
      if (p && (p.thumbnail_large?.src || p.thumbnail?.src)) {
        body = {
          found: true,
          src: p.thumbnail_large?.src || p.thumbnail.src,
          width: p.thumbnail_large?.size?.width || p.thumbnail?.size?.width || null,
          height: p.thumbnail_large?.size?.height || p.thumbnail?.size?.height || null,
          photographer: p.photographer || null,
          link: p.link || null
        };
      }
    } else if (res.status >= 500) {
      return NextResponse.json({ found: false }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ found: false }, { status: 502 });
  }
  // תמונה נשמרת לשבוע; "אין תמונה" נשמר ליום
  await cacheSet(key, body, body.found ? 7 * 24 * 3600 : 24 * 3600);
  return NextResponse.json(body);
}
