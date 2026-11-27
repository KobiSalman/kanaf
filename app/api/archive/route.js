import { NextResponse } from 'next/server';
import { freshBoardRows } from '../../../lib/iaa';
import { archiveBoard } from '../../../lib/history';
import { noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// נקרא פעם ביום מ-Vercel Cron (vercel.json). אם מוגדר CRON_SECRET, רק Vercel יכול להפעיל
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  }
  try {
    const rows = await freshBoardRows();
    const r = await archiveBoard(rows, { force: true });
    return NextResponse.json({ ok: true, rows: rows.length, ...r }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 502, headers: noStore });
  }
}
