// מטמון משותף לכל השרתים, ב-Redis של Upstash (חיבור דרך Vercel ‏Storage).
// אם אין חיבור, נופלים למטמון בזיכרון של השרת (עובד, אבל לא משותף בין שרתים).

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = new Map();

export const sharedCacheEnabled = Boolean(URL_ && TOKEN);

async function redis(command) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

// מחזיר { value, at } או null
export async function cacheGet(key) {
  if (sharedCacheEnabled) {
    try {
      const raw = await redis(['GET', key]);
      if (raw) return JSON.parse(raw);
    } catch {
      // Redis לא זמין: ממשיכים עם הזיכרון המקומי
    }
  }
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.entry;
  return null;
}

// keepSeconds: כמה זמן לשמור את הערך בכלל (גם אחרי שהוא כבר לא טרי), כדי שיהיה מה להציג אם המקור נופל
export async function cacheSet(key, value, keepSeconds) {
  const entry = { value, at: Date.now() };
  memory.set(key, { entry, expires: Date.now() + keepSeconds * 1000 });
  if (memory.size > 500) memory.delete(memory.keys().next().value);
  if (sharedCacheEnabled) {
    try {
      await redis(['SET', key, JSON.stringify(entry), 'EX', String(keepSeconds)]);
    } catch {
      // לא נורא: נשאר בזיכרון המקומי
    }
  }
  return entry;
}

// ---------- מנעול: רק שרת אחד מביא נתונים חדשים בכל פעם ----------
const memLocks = new Map();

async function tryLock(key, seconds) {
  if (sharedCacheEnabled) {
    try { return (await redis(['SET', `lock:${key}`, '1', 'NX', 'EX', String(seconds)])) === 'OK'; } catch {}
  }
  const until = memLocks.get(key);
  if (until && until > Date.now()) return false;
  memLocks.set(key, Date.now() + seconds * 1000);
  return true;
}

async function unlock(key) {
  memLocks.delete(key);
  if (sharedCacheEnabled) { try { await redis(['DEL', `lock:${key}`]); } catch {} }
}

// ---------- הפסקה אחרי "יותר מדי בקשות" ----------
export class RateLimited extends Error {
  constructor(source, retryAfterSec) { super(source); this.retryAfterSec = retryAfterSec || null; }
}

// מונה בקשות יומי לכל מקור חיצוני (לפי תאריך UTC, כמו המכסה של adsb.lol). נשמר 3 ימים
export async function countUsage(source) {
  if (!sharedCacheEnabled) return;
  const day = new Date().toISOString().slice(0, 10);
  try { const k = `usage:${source}:${day}`; await redis(['INCR', k]); await redis(['EXPIRE', k, 3 * 86400]); } catch {}
}
export async function usageToday(source) {
  if (!sharedCacheEnabled) return null;
  try { return Number(await redis(['GET', `usage:${source}:${new Date().toISOString().slice(0, 10)}`])) || 0; } catch { return null; }
}

export async function inCooldown(source) {
  const c = await cacheGet(`cooldown:${source}`);
  return !!c;
}

export async function startCooldown(source, seconds) {
  await cacheSet(`cooldown:${source}`, true, seconds);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * מביא נתונים דרך המטמון המשותף:
 * - טרי (פחות מ-freshMs): מחזירים מהמטמון
 * - לא טרי: רק מי שמקבל את המנעול מביא מהמקור; כל השאר מקבלים את הערך הקודם
 * - המקור נכשל, או במצב הפסקה אחרי 429: מחזירים את הערך האחרון ששמרנו, עם stale
 * מחזיר { value, at, stale }
 */
export async function cachedFetch(key, { freshMs, keepSeconds, source }, fetcher) {
  let cached = await cacheGet(key);
  const fresh = typeof freshMs === 'function' ? (cached ? freshMs(cached.value) : 0) : freshMs;
  if (cached && Date.now() - cached.at < fresh) return { ...cached, stale: false };

  if (source && (await inCooldown(source))) {
    if (cached) return { ...cached, stale: true };
    throw new RateLimited(source);
  }

  const owned = await tryLock(key, 15);
  if (!owned) {
    if (cached) return { ...cached, stale: false };
    // אין עדיין כלום: מחכים רגע שהשרת שמביא יסיים
    for (let i = 0; i < 8 && !cached; i++) { await sleep(250); cached = await cacheGet(key); }
    if (cached) return { ...cached, stale: false };
    // לא הגיע כלום: מביאים בעצמנו
  }

  try {
    const value = await fetcher();
    const entry = await cacheSet(key, value, keepSeconds);
    return { ...entry, stale: false };
  } catch (e) {
    if (e instanceof RateLimited && source) await startCooldown(source, Math.min(3600, Math.max(30, e.retryAfterSec || 30)));
    if (cached) return { ...cached, stale: true };
    throw e;
  } finally {
    if (owned) await unlock(key);
  }
}

// כותרת מטמון לרשת של Vercel: תשובה זהה לכל מי שמבקש את אותה כתובת
export function cdnHeaders(sMaxAge, swr) {
  return { 'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` };
}
export const noStore = { 'Cache-Control': 'no-store' };
