import ReportButton from './ReportButton';
// הלוגו של כנף: זנב מטוס כתום על רקע שמיים, עם שמש
export function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs><clipPath id="kanaf-logo-clip"><rect width="48" height="48" rx="14" /></clipPath></defs>
      <g clipPath="url(#kanaf-logo-clip)">
        <rect width="48" height="48" fill="#6EC6FF" />
        <circle cx="12" cy="13" r="6" fill="#FFC93C" />
        <path d="M17 32 L29 8.5 Q30 7 32 7 L36.5 7 Q38.5 7 38.3 9 L36.5 31 Z" fill="#FF7A59" />
        <path d="M-2 33 L36 29.5 Q43 29.5 44 33 Q43 36.5 36 37 L-2 40 Z" fill="#fff" />
        <path d="M23.5 25 L32 9.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function BrandBar() {
  return (
    <div className="brand">
      <a href="/" className="brand-name" aria-label="כנף, לדף הבית">
        <LogoMark />
        <span>כנף</span>
      </a>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="brand-tag">מלווה הטיסה שלך</span>
        <ReportButton />
      </span>
    </div>
  );
}
