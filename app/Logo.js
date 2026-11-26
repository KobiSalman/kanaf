// הלוגו של כנף: כנף לבנה ושמש על ריבוע כתום
const WING = 'M7 25 C13 15 28 12 43 15 C39 19 35 21 31 22 C34 23 35 24 35 25.5 C31 27.5 27 28 23.5 28 C25.5 29 26 30 25.5 31 C21 33.5 16 33.5 12.5 32.5 C9 31.5 7 29 7 25 Z';

export function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#FF7A59" />
      <circle cx="15" cy="15" r="6" fill="#FFC93C" />
      <path transform="rotate(-12 24 24)" d={WING} fill="#fff" />
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
      <span className="brand-tag">מלווה הטיסה שלך</span>
    </div>
  );
}
