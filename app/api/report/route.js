import { NextResponse } from 'next/server';
import { rateLimited, noStore } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

// "דווח על בעיה": שולח את הדיווח במייל דרך Resend. המפתח והכתובת נמצאים רק בהגדרות של Vercel
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

export async function POST(request) {
  const key = process.env.RESEND_API_KEY, to = process.env.REPORT_TO_EMAIL;
  if (!key || !to) return NextResponse.json({ error: 'שליחת דיווחים עוד לא הוגדרה.' }, { status: 503, headers: noStore });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400, headers: noStore }); }
  // מלכודת לבוטים: שדה נסתר שאדם לא ממלא
  if (body.website) return NextResponse.json({ ok: true }, { headers: noStore });

  const message = clip(body.message, 2000);
  if (message.length < 3) return NextResponse.json({ error: 'כתבו מה לא עבד' }, { status: 400, headers: noStore });
  const email = clip(body.email, 120);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (await rateLimited(`report:${ip}`, 5, 3600)) {
    return NextResponse.json({ error: 'שלחת כבר כמה דיווחים בשעה האחרונה. אפשר לנסות שוב מאוחר יותר.' }, { status: 429, headers: noStore });
  }

  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  const lines = [
    message, '', '— פרטים —',
    `מייל לחזרה: ${validEmail || 'לא נמסר'}`,
    `טיסה: ${clip(ctx.flight, 12) || '—'} ${clip(ctx.date, 10)}`,
    `לשונית: ${clip(ctx.tab, 20) || '—'} · שלב: ${clip(ctx.stage, 20) || '—'}`,
    `כתובת: ${clip(ctx.url, 300) || '—'}`,
    `מכשיר: ${clip(request.headers.get('user-agent'), 300)}`,
    `זמן: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`
  ];
  const subject = `כנף · דיווח${ctx.flight ? ` על ${clip(ctx.flight, 12)}` : ''}: ${message.slice(0, 50).replace(/\s+/g, ' ')}`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.REPORT_FROM || 'Kanaf <onboarding@resend.dev>', to: [to], subject, text: lines.join('\n'), ...(validEmail ? { reply_to: validEmail } : {}) }),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
  } catch {
    return NextResponse.json({ error: 'לא הצלחנו לשלוח כרגע. נסו שוב בעוד כמה דקות.' }, { status: 502, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
