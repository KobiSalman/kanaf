import { NextResponse } from 'next/server';
import { fullBoard } from '../../../lib/iaa';
import { localToInstant } from '../../../lib/time';
import { cdnHeaders, noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

const HOUR = 3600e3;

// עומס צפוי בנתב״ג, לפי לוח הטיסות: כמה המראות ונחיתות יש בכל שעה (בלי טיסות שבוטלו)
export async function GET() {
  let board;
  try { board = await fullBoard(); } catch {
    return NextResponse.json({ error: 'הלוח של נתב״ג לא זמין כרגע.' }, { status: 502, headers: noStore });
  }
  const start = Math.floor(Date.now() / HOUR) * HOUR - 4 * HOUR;
  const hours = Array.from({ length: 36 }, (_, i) => ({ t: start + i * HOUR, dep: 0, arr: 0 }));
  // טיסות בשיתוף קוד (למשל LY339 ו-KL2475) מופיעות בלוח כמה פעמים: סופרים כל מטוס פעם אחת
  const seen = new Set();
  for (const r of board.rows) {
    if (/CANCEL/.test(r.st)) continue;
    const key = `${r.dir}|${r.ptol}|${r.loc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = localToInstant(r.ptol, 'Asia/Jerusalem');
    if (!t) continue;
    const i = Math.floor((t - start) / HOUR);
    if (i < 0 || i >= hours.length) continue;
    if (r.dir === 'D') hours[i].dep++; else hours[i].arr++;
  }
  return NextResponse.json({ hours, at: new Date(board.at).toISOString() }, { headers: cdnHeaders(300, 600) });
}
