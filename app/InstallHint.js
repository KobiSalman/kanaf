'use client';
import { useEffect, useState } from 'react';
import { useT } from './i18n';

// "רוצים את כנף כאפליקציה?": באנדרואיד כפתור התקנה, באייפון הסבר קצר. לא מופיע אם כנף כבר מותקנת או אם סגרו את ההודעה
export default function InstallHint() {
  const tr = useT();
  const [mode, setMode] = useState(null);
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    try {
      const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (installed || localStorage.getItem('kanaf:install') === 'no') return;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (ios) { setMode('ios'); return; }
      const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setMode('android'); };
      window.addEventListener('beforeinstallprompt', onPrompt);
      return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    } catch {}
  }, []);
  if (!mode) return null;
  const close = () => { try { localStorage.setItem('kanaf:install', 'no'); } catch {} setMode(null); };
  return (
    <section className="card install-hint" role="note">
      <div className="row">
        <span className="strong">{tr('📲 רוצים את כנף כאפליקציה?')}</span>
        <button type="button" onClick={close} aria-label={tr('סגור')} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'inherit' }}>✕</button>
      </div>
      {mode === 'ios' ? (
        <span style={{ fontSize: 14, lineHeight: 1.55 }}>{tr('בספארי: לחצו על כפתור השיתוף {share} למטה, ואז על {add}. כנף תופיע עם אייקון, ותיפתח במסך מלא.', { share: <b>⬆️</b>, add: <b>{tr('״הוסף למסך הבית״')}</b> })}</span>
      ) : (
        <button type="button" className="btn-sun" onClick={async () => { prompt?.prompt(); await prompt?.userChoice; close(); }} style={{ height: 44 }}>{tr('הוסף למסך הבית')}</button>
      )}
    </section>
  );
}
