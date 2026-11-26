import { NextResponse } from 'next/server';
import { fullBoard } from '../../../lib/iaa';
import { localToInstant } from '../../../lib/time';
import { cdnHeaders, noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

// כל היעדים שיש אליהם המראות מנתב״ג בשלושת הימים הקרובים, להשלמה האוטומטית של "לאן טסים?"
export async function GET() {
  let board;
  try { board = await fullBoard(); } catch {
    return NextResponse.json({ error: 'הלוח של נתב״ג לא זמין כרגע. נסה שוב בעוד כמה דקות.' }, { status: 502, headers: noStore });
  }
  const now = Date.now();
  const byLoc = new Map();
  const seen = new Set();
  for (const r of board.rows) {
    if (r.dir !== 'D' || /CANCEL|DEPARTED/.test(r.st)) continue;
    const t = localToInstant(r.ptol, 'Asia/Jerusalem');
    if (!t || t < now - 30 * 60e3 || t > now + 72 * 3600e3) continue;
    const d = byLoc.get(r.loc) || { loc: r.loc, city: r.city, cityEn: r.cityEn, country: r.country, countryEn: r.countryEn || '', flights: 0 };
    // טיסות בשיתוף קוד נספרות פעם אחת
    const key = `${r.ptol}|${r.loc}`;
    if (!seen.has(key)) { seen.add(key); d.flights++; }
    byLoc.set(r.loc, d);
  }
  const destinations = [...byLoc.values()].sort((a, b) => b.flights - a.flights);
  return NextResponse.json({ destinations, at: new Date(board.at).toISOString() }, { headers: cdnHeaders(300, 900) });
}
