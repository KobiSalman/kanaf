import { NextResponse } from 'next/server';
import { sharedCacheEnabled, cacheGet, cacheSet } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

// בדיקת מצב: האם המטמון המשותף מחובר ועובד (בלי לחשוף סודות)
export async function GET() {
  let sharedCacheWorks = false;
  if (sharedCacheEnabled) {
    try {
      const stamp = Date.now();
      await cacheSet('health:ping', stamp, 60);
      const got = await cacheGet('health:ping');
      sharedCacheWorks = got?.value === stamp;
    } catch {}
  }
  return NextResponse.json({
    ok: true,
    aviationstackKey: Boolean(process.env.AVIATIONSTACK_KEY),
    sharedCacheConnected: sharedCacheEnabled,
    sharedCacheWorks,
    message: sharedCacheWorks
      ? 'המטמון המשותף מחובר ועובד ✓'
      : sharedCacheEnabled
        ? 'פרטי החיבור קיימים, אבל המטמון לא הגיב. כדאי לבדוק את מסד הנתונים ב-Vercel.'
        : 'המטמון המשותף לא מחובר: לא נמצאו KV_REST_API_URL ו-KV_REST_API_TOKEN בפרויקט.'
  });
}
