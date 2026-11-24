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
