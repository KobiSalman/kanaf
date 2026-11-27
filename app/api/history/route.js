import { NextResponse } from 'next/server';
import { parseFlight } from '../../../lib/iaa';
import { flightHistory } from '../../../lib/history';
import { cdnHeaders, noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

// כמה הטיסה הזו מדייקת: /api/history?flight=W62328&dir=D
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const p = parseFlight(String(searchParams.get('flight') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const dir = searchParams.get('dir') === 'A' ? 'A' : 'D';
  if (!p) return NextResponse.json({ error: 'מספר טיסה לא תקין' }, { status: 400, headers: noStore });
  try {
    const h = await flightHistory(p.airline, `${p.number}${p.suffix || ''}`, dir);
    return NextResponse.json(h, { headers: cdnHeaders(3600, 3600) });
  } catch {
    return NextResponse.json({ n: 0 }, { headers: cdnHeaders(300, 300) });
  }
}
