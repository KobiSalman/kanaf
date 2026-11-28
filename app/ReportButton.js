'use client';
import { useEffect, useRef, useState } from 'react';
import { useT, apiUrl } from './i18n';

// תווית "בהרצה" ליד הלוגו. לחיצה פותחת טופס קצר לדיווח על בעיה, שנשלח במייל
export default function ReportButton() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [err, setErr] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    setTimeout(() => box.current?.focus(), 50);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (e) => {
    e.preventDefault();
    setState('sending'); setErr('');
    try {
      const context = { ...(window.__kanafCtx || {}), url: window.location.href };
      const r = await fetch(apiUrl(tr, '/api/report'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, email, website: trap, context }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(b.error || tr('משהו השתבש')); setState('error'); return; }
      setState('done'); setMsg('');
    } catch { setErr(tr('אין חיבור לאינטרנט')); setState('error'); }
  };

  const close = () => { setOpen(false); if (state === 'done') setState('idle'); };

  return (
    <>
      <button type="button" className="beta-chip" onClick={() => setOpen(true)} aria-haspopup="dialog">{tr('בהרצה · דווח על בעיה')}</button>
      {open && (
        <div className="sheet-bg" onClick={close}>
          <form className="sheet" role="dialog" aria-modal="true" aria-label={tr('דיווח על בעיה')} onClick={(e) => e.stopPropagation()} onSubmit={send}>
            <div className="row">
              <h2 style={{ fontSize: 18 }}>{tr('משהו לא עבד?')}</h2>
              <button type="button" onClick={close} aria-label={tr('סגור')} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'inherit' }}>✕</button>
            </div>
            {state === 'done' ? (
              <>
                <span style={{ fontSize: 16, lineHeight: 1.6 }}>{tr('תודה! הדיווח נשלח, ונעבור עליו בהקדם 🙏')}</span>
                <button type="button" className="btn-sun" onClick={close} style={{ flex: 'none' }}>{tr('סגור')}</button>
              </>
            ) : (
              <>
                <span className="small muted">{tr('כנף עדיין בהרצה, וכל דיווח עוזר לנו לתקן. נצרף לדיווח את הטיסה והמסך שבהם היית, כדי שנבין מה קרה.')}</span>
                <label className="field"><span>{tr('מה קרה?')}</span>
                  <textarea ref={box} value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} maxLength={2000} required placeholder={tr('למשל: השעה בכרטיס לא תואמת ללוח בשדה')} />
                </label>
                <label className="field"><span>{tr('מייל, אם תרצו שנחזור אליכם (לא חובה)')}</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" dir="ltr" />
                </label>
                <input type="text" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: -9999, width: 1, height: 1, opacity: 0 }} name="website" />
                {state === 'error' && <div className="error" role="alert">{err}</div>}
                <button type="submit" className="btn-sun" disabled={state === 'sending' || msg.trim().length < 3} style={{ flex: 'none' }}>{state === 'sending' ? tr('שולח…') : tr('שלח דיווח')}</button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
