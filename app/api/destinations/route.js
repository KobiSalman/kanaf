import { NextResponse } from 'next/server';
import { fullBoard } from '../../../lib/iaa';
import { localToInstant } from '../../../lib/time';
import { cdnHeaders, noStore } from '../../../lib/cache';
import { tOf } from '../../../lib/i18nServer';
import { localizeRow } from '../../../lib/localize';

export const dynamic = 'force-dynamic';

// כל היעדים שיש אליהם המראות, או מהם נחיתות, בנתב״ג בשלושת הימים הקרובים, להשלמה האוטומטית של "לאן טסים?"
export async function GET(request) {
  const t = tOf(request);
  let board;
  try { board = await fullBoard(); } catch {
    return NextResponse.json({ error: t('הלוח של נתב״ג לא זמין כרגע. נסה שוב בעוד כמה דקות.') }, { status: 502, headers: noStore });
  }
  const now = Date.now();
  const byLoc = new Map();
  const seen = new Set();
  for (const r of board.rows) {
    if (/CANCEL/.test(r.st) || (r.dir === 'D' && /DEPARTED/.test(r.st)) || (r.dir === 'A' && /LANDED/.test(r.st))) continue;
    const at = localToInstant(r.ptol, 'Asia/Jerusalem');
    if (!at || at < now - 30 * 60e3 || at > now + 72 * 3600e3) continue;
    let d = byLoc.get(r.loc);
    if (!d) { const { city, country } = localizeRow(r, t); d = { loc: r.loc, city, cityEn: r.cityEn, country, countryEn: r.countryEn || '', flights: 0, arrivals: 0 }; }
    // טיסות בשיתוף קוד נספרות פעם אחת. flights = המראות לשם, arrivals = נחיתות משם
    const key = `${r.dir}|${r.ptol}|${r.loc}`;
    if (!seen.has(key)) { seen.add(key); if (r.dir === 'D') d.flights++; else d.arrivals++; }
    byLoc.set(r.loc, d);
  }
  const destinations = [...byLoc.values()].sort((a, b) => b.flights - a.flights || b.arrivals - a.arrivals);
  return NextResponse.json({ destinations, at: new Date(board.at).toISOString() }, { headers: cdnHeaders(300, 900) });
}
