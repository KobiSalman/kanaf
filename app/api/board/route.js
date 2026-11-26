import { NextResponse } from 'next/server';
import { fullBoard } from '../../../lib/iaa';
import { localToInstant } from '../../../lib/time';
import { cdnHeaders, noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

// לוח המראות/נחיתות של נתב״ג: חלון של שעתיים אחורה ו-12 שעות קדימה, עם חיפוש
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dir = searchParams.get('dir') === 'A' ? 'A' : 'D';
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const hoursBack = 2, hoursAhead = q ? 72 : 12;

  let board;
  try { board = await fullBoard(); } catch {
    return NextResponse.json({ error: 'הלוח של נתב״ג לא זמין כרגע. נסה שוב בעוד כמה דקות.' }, { status: 502, headers: noStore });
  }
  const now = Date.now();
  const rows = board.rows
    .filter((r) => r.dir === dir)
    .map((r) => ({ ...r, t: localToInstant(r.ptol, 'Asia/Jerusalem') }))
    .filter((r) => r.t && r.t > now - hoursBack * 3600e3 && r.t < now + hoursAhead * 3600e3)
    .filter((r) => !q || [r.city, r.cityEn, r.country, r.loc, r.opName, r.op, `${r.op}${r.fn}`].some((x) => String(x).toLowerCase().includes(q)))
    .sort((a, b) => a.t - b.t)
    .slice(0, 200);

  return NextResponse.json({ dir, rows, at: new Date(board.at).toISOString(), stale: !!board.stale }, { headers: cdnHeaders(60, 300) });
}
