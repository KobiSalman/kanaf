// תמונת התצוגה המקדימה כשמשתפים טיסה בוואטסאפ (1200x630)
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getT, langOf } from '../../../lib/i18nServer';

export const runtime = 'nodejs';

const font = (f) => readFile(path.join(process.cwd(), 'app/api/og', f));
const HEB = /[֐-׿]/;

// המנוע שמצייר את התמונה לא יודע לכתוב מימין לשמאל, אז הופכים בעצמנו:
// מילים בעברית נהפכות אות-אות, וסדר המילים מתהפך (flex row-reverse)
function Words({ text, size, weight = 800, color = '#0B2545', gap, rtl = true }) {
  // רצף של מילים בלי עברית (Wizz Air) נשאר יחד ובסדר המקורי
  const words = [];
  for (const w of String(text || '').split(/\s+/).filter(Boolean)) {
    const last = words[words.length - 1];
    if (!HEB.test(w) && last && !HEB.test(last)) words[words.length - 1] = `${last} ${w}`; else words.push(w);
  }
  return (
    <div style={{ display: 'flex', flexDirection: rtl ? 'row-reverse' : 'row', gap: gap ?? Math.round(size * 0.28), fontSize: size, fontWeight: weight, color }}>
      {words.map((w, i) => <span key={i}>{rtl && HEB.test(w) ? [...w].reverse().join('') : w}</span>)}
    </div>
  );
}

const clip = (s, n) => String(s || '').slice(0, n);

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const t = getT(langOf(req));
  const rtl = t.dir === 'rtl';
  const ROW = rtl ? 'row-reverse' : 'row';
  const W = (p) => <Words rtl={rtl} {...p} />;
  const [h7, h8, l7, l8] = await Promise.all([
    font('./rubik-hebrew-700-normal.woff'), font('./rubik-hebrew-800-normal.woff'),
    font('./rubik-latin-700-normal.woff'), font('./rubik-latin-800-normal.woff')
  ]);
  const flight = clip(q.get('f'), 8);
  const from = clip(q.get('from'), 22), to = clip(q.get('to'), 22);
  const airline = clip(q.get('a'), 30), kind = clip(q.get('k'), 10), time = clip(q.get('t'), 5);
  const status = clip(q.get('s'), 24), tone = q.get('tone') || '';
  const pill = { bad: ['#FFE1DC', '#B3261E'], warn: ['#FFF1C7', '#8A5A00'], good: ['#DDF6E6', '#1B7A43'] }[tone] || ['#E7F1FA', '#244B6E'];

  const logo = (
    <svg width="84" height="84" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="14" fill="#6EC6FF" />
      <circle cx="12" cy="13" r="6" fill="#FFC93C" />
      <path d="M17 32 L29 8.5 Q30 7 32 7 L36.5 7 Q38.5 7 38.3 9 L36.5 31 Z" fill="#FF7A59" />
      <path d="M2 33 L36 29.5 Q43 29.5 44 33 Q43 36.5 36 37 L2 40 Z" fill="#fff" />
    </svg>
  );

  // בלי טיסה (שיתוף של האתר עצמו): שמיים, מטוס גדול בדרך, והשם כנף
  if (!flight) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'linear-gradient(180deg,#5DB8F5 0%,#8FD3FF 70%,#CFEFFF 100%)', fontFamily: 'Rubik, RubikHe', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 80, top: 46, width: 140, height: 140, borderRadius: 999, background: '#FFC93C' }} />
          <div style={{ position: 'absolute', left: 30, top: 170, width: 250, height: 70, borderRadius: 999, background: '#fff', opacity: 0.95 }} />
          <div style={{ position: 'absolute', left: 90, top: 140, width: 110, height: 86, borderRadius: 999, background: '#fff', opacity: 0.95 }} />
          <div style={{ position: 'absolute', left: 360, top: 500, width: 300, height: 76, borderRadius: 999, background: '#fff', opacity: 0.85 }} />
          <div style={{ position: 'absolute', left: 440, top: 472, width: 130, height: 86, borderRadius: 999, background: '#fff', opacity: 0.85 }} />
          <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: 'absolute', left: 0, top: 0 }}>
            <path d="M60 600 C 160 520, 250 450, 330 360" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 26" fill="none" opacity="0.9" />
            <g transform="translate(420 260) rotate(45) scale(9) translate(-12 -12)">
              <path fill="#FF7A59" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
            </g>
          </svg>
          <div style={{ position: 'absolute', right: 70, top: 120, display: 'flex', flexDirection: 'column', alignItems: rtl ? 'flex-end' : 'flex-start', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'center', gap: 22 }}>
              <svg width="120" height="120" viewBox="0 0 48 48">
                <rect width="48" height="48" rx="14" fill="#fff" />
                <circle cx="12" cy="13" r="6" fill="#FFC93C" />
                <path d="M17 32 L29 8.5 Q30 7 32 7 L36.5 7 Q38.5 7 38.3 9 L36.5 31 Z" fill="#FF7A59" />
                <path d="M2 33 L36 29.5 Q43 29.5 44 33 Q43 36.5 36 37 L2 40 Z" fill="#6EC6FF" />
              </svg>
              <W text={t('כנף')} size={130} color="#0B2545" />
            </div>
            <W text={t('מלווה הטיסה שלך')} size={52} weight={800} color="#0B2545" />
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.9)', borderRadius: 999, padding: '14px 30px', marginTop: 10 }}>
              <W text={t('מתי להגיע לשדה · איפה המטוס · מתי נוחתים')} size={30} weight={700} color="#244B6E" />
            </div>
          </div>
        </div>
      ),
      {
        width: 1200, height: 630,
        fonts: [
          { name: 'Rubik', data: l7, weight: 700 }, { name: 'Rubik', data: l8, weight: 800 },
          { name: 'RubikHe', data: h7, weight: 700 }, { name: 'RubikHe', data: h8, weight: 800 }
        ],
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' }
      }
    );
  }

  const body = flight ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'center', gap: 18 }}>
          <span style={{ fontSize: 64, fontWeight: 800, color: '#0B2545' }}>{flight}</span>
          {airline ? <W text={airline} size={36} weight={700} color="#5B6B7F" /> : null}
        </div>
        {status ? <div style={{ display: 'flex', background: pill[0], borderRadius: 999, padding: '10px 28px' }}><W text={status} size={36} color={pill[1]} /></div> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'center', gap: 28 }}>
        <W text={from} size={from.length > 12 || to.length > 12 ? 58 : 74} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 84, height: 84, borderRadius: 999, background: '#FF7A59' }}>
          <svg width="46" height="46" viewBox="0 0 24 24"><path fill="#fff" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform={rtl ? "rotate(-90 12 12)" : "rotate(90 12 12)"} /></svg>
        </div>
        <W text={to} size={from.length > 12 || to.length > 12 ? 58 : 74} />
      </div>
      {time ? (
        <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'baseline', gap: 18 }}>
          <W text={kind} size={40} weight={700} color="#5B6B7F" />
          <span style={{ fontSize: 60, fontWeight: 800, color: '#0B2545' }}>{time}</span>
        </div>
      ) : null}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: rtl ? 'flex-end' : 'flex-start', gap: 20 }}>
      <W text={t('כל המידע על הטיסה שלך')} size={70} />
      <W text={t('מתי להגיע לשדה · איפה המטוס · מתי נוחתים')} size={38} weight={700} color="#5B6B7F" />
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'linear-gradient(160deg,#8FD3FF,#5DB8F5)', padding: 44, fontFamily: 'Rubik, RubikHe' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', background: '#fff', borderRadius: 40, padding: '44px 56px', boxShadow: '0 18px 40px rgba(11,37,69,0.18)' }}>
          <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: ROW, alignItems: 'center', gap: 18 }}>
              {logo}
              <W text={t('כנף')} size={56} />
            </div>
            <W text={flight ? t('מעקב חי אחרי הטיסה') : t('מלווה הטיסה שלך')} size={32} weight={700} color="#5B6B7F" />
          </div>
          {body}
        </div>
      </div>
    ),
    {
      width: 1200, height: 630,
      fonts: [
        { name: 'Rubik', data: l7, weight: 700 }, { name: 'Rubik', data: l8, weight: 800 },
        { name: 'RubikHe', data: h7, weight: 700 }, { name: 'RubikHe', data: h8, weight: 800 }
      ],
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' }
    }
  );
}
