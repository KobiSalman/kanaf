// איור: שני מטיילים עם מזוודות הולכים בטרמינל, ומטוס ממריא מאחורי החלון
export default function TravelersArt() {
  return (
    <svg viewBox="0 0 360 130" width="100%" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="0" y="0" width="360" height="96" fill="#DDF1FD" />
      <g stroke="#B9DDF4" strokeWidth="3">
        <line x1="60" y1="0" x2="60" y2="96" /><line x1="150" y1="0" x2="150" y2="96" /><line x1="240" y1="0" x2="240" y2="96" /><line x1="330" y1="0" x2="330" y2="96" />
      </g>
      <circle cx="176" cy="24" r="12" fill="#FFC93C" />
      <ellipse cx="215" cy="26" rx="20" ry="6" fill="#fff" /><ellipse cx="228" cy="21" rx="12" ry="7" fill="#fff" />
      <path d="M8 74 Q50 70 86 54" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
      <g className="art-plane" transform="translate(110 40) rotate(-18)">
        <path d="M-34 0 Q-30 -5 -18 -5 L22 -5 Q34 -5 38 0 Q34 5 22 5 L-18 5 Q-30 5 -34 0Z" fill="#fff" stroke="#0E2A47" strokeWidth="1.2" />
        <path d="M-4 -4 L-14 -20 L-8 -20 L10 -4Z" fill="#FF7A59" />
        <path d="M-4 4 L-14 18 L-8 18 L10 4Z" fill="#FF7A59" opacity="0.85" />
        <path d="M-30 -4 L-36 -14 L-31 -14 L-22 -4Z" fill="#FF7A59" />
      </g>
      <rect x="0" y="96" width="360" height="34" fill="#F3EBD3" />
      <line x1="0" y1="110" x2="360" y2="110" stroke="#E6DABA" strokeWidth="2" />

      {/* מטיילת: מעיל כתום, קוקו, מזוודה כחולה */}
      <g transform="translate(250 30)">
        <g className="art-walk">
          <ellipse cx="22" cy="92" rx="34" ry="4" fill="#000" opacity="0.08" />
          <line x1="44" y1="44" x2="38" y2="62" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="40" y="60" width="20" height="26" rx="5" fill="#2E86DE" />
          <rect x="44" y="66" width="12" height="3" rx="1.5" fill="#fff" opacity="0.7" />
          <circle cx="44" cy="88" r="2.5" fill="#0E2A47" /><circle cx="56" cy="88" r="2.5" fill="#0E2A47" />
          <path d="M14 62 L8 88" stroke="#0E2A47" strokeWidth="7" strokeLinecap="round" />
          <path d="M22 62 L30 87" stroke="#0E2A47" strokeWidth="7" strokeLinecap="round" />
          <path d="M4 89 h8" stroke="#fff" strokeWidth="5" strokeLinecap="round" /><path d="M28 89 h8" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <rect x="6" y="28" width="26" height="38" rx="11" fill="#FF7A59" />
          <path d="M28 36 L42 46" stroke="#FF7A59" strokeWidth="7" strokeLinecap="round" />
          <path d="M10 36 L2 54" stroke="#FF7A59" strokeWidth="7" strokeLinecap="round" />
          <circle cx="19" cy="15" r="11" fill="#F4C7A1" />
          <path d="M8 14 Q8 1 20 2 Q31 2 31 14 Q27 7 19 8 Q12 8 8 14Z" fill="#5B3A29" />
          <path d="M30 12 Q36 20 32 30" stroke="#5B3A29" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="14" cy="16" r="1.4" fill="#0E2A47" />
          <path d="M11 20 Q14 22 17 20" stroke="#0E2A47" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* מטייל: חולצה צהובה, כובע, תיק גב, מזוודה כתומה */}
      <g transform="translate(180 28)">
        <g className="art-walk slow">
          <ellipse cx="22" cy="94" rx="34" ry="4" fill="#000" opacity="0.08" />
          <line x1="44" y1="46" x2="38" y2="64" stroke="#0E2A47" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="40" y="62" width="22" height="26" rx="5" fill="#FF7A59" />
          <rect x="44" y="68" width="14" height="3" rx="1.5" fill="#fff" opacity="0.7" />
          <circle cx="45" cy="90" r="2.5" fill="#0E2A47" /><circle cx="57" cy="90" r="2.5" fill="#0E2A47" />
          <path d="M14 64 L6 90" stroke="#4A6380" strokeWidth="7" strokeLinecap="round" />
          <path d="M22 64 L28 90" stroke="#4A6380" strokeWidth="7" strokeLinecap="round" />
          <path d="M2 91 h8" stroke="#0E2A47" strokeWidth="5" strokeLinecap="round" /><path d="M26 91 h8" stroke="#0E2A47" strokeWidth="5" strokeLinecap="round" />
          <rect x="26" y="34" width="12" height="24" rx="5" fill="#0B5A33" />
          <rect x="6" y="30" width="26" height="38" rx="11" fill="#FFC93C" />
          <path d="M28 38 L42 48" stroke="#FFC93C" strokeWidth="7" strokeLinecap="round" />
          <path d="M12 38 L6 56" stroke="#FFC93C" strokeWidth="7" strokeLinecap="round" />
          <circle cx="19" cy="17" r="11" fill="#E0A878" />
          <path d="M31 14 Q29 3 18 3 Q8 3 7 12 L1 13 Q0 15 4 15 L30 16Z" fill="#2E86DE" />
          <circle cx="14" cy="19" r="1.4" fill="#0E2A47" />
          <path d="M11 23 Q14 25 17 23" stroke="#0E2A47" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
