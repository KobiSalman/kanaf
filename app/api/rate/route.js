import { NextResponse } from 'next/server';
import { cachedFetch, cdnHeaders, noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

// שער המטבע מול השקל, מהבנק המרכזי האירופי (דרך frankfurter.dev). מתעדכן פעם ביום, נשמר במטמון ל-12 שעות
const SUPPORTED = new Set('AUD BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF IDR INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON SEK SGD THB TRY USD ZAR'.split(' '));

export async function GET(request) {
  const cur = (new URL(request.url).searchParams.get('cur') || '').toUpperCase();
  if (!SUPPORTED.has(cur)) return NextResponse.json({ error: 'אין שער למטבע הזה' }, { status: 404, headers: cdnHeaders(86400, 86400) });
  try {
    const r = await cachedFetch(`rate:${cur}`, { freshMs: 12 * 3600e3, keepSeconds: 7 * 86400, source: 'rates' }, async () => {
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${cur}&to=ILS`, { cache: 'no-store' });
      if (!res.ok) throw new Error('rate');
      const b = await res.json();
      if (!b?.rates?.ILS) throw new Error('rate');
      return { cur, ils: b.rates.ILS, date: b.date };
    });
    return NextResponse.json(r.value, { headers: cdnHeaders(3600, 43200) });
  } catch {
    return NextResponse.json({ error: 'השער לא זמין כרגע' }, { status: 502, headers: noStore });
  }
}
