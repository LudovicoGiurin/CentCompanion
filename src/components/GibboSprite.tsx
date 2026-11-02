/** Pixel jester mascot — Gibbo */
export function GibboSprite({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`cc-gibbo-sprite ${className}`.trim()}
      viewBox="0 0 32 32"
      width="64"
      height="64"
      aria-hidden
      role="img"
    >
      {/* hat */}
      <rect x="8" y="2" width="16" height="4" fill="#f0a232" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="6" y="5" width="20" height="3" fill="#ffd27a" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="4" y="7" width="4" height="8" fill="#d94343" stroke="#1c1c1c" strokeWidth="1" />
      <circle cx="6" cy="16" r="2" fill="#ffd27a" stroke="#1c1c1c" strokeWidth="1" />
      {/* face */}
      <rect x="10" y="8" width="12" height="11" fill="#fbf5dd" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="12" y="12" width="2" height="2" fill="#1c1c1c" />
      <rect x="18" y="12" width="2" height="2" fill="#1c1c1c" />
      <rect x="13" y="16" width="6" height="2" fill="#d94343" stroke="#1c1c1c" strokeWidth="0.5" />
      {/* ruff */}
      <rect x="8" y="19" width="16" height="3" fill="#fff" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="9" y="20" width="2" height="1" fill="#3aa0e6" />
      <rect x="13" y="20" width="2" height="1" fill="#2fa84f" />
      <rect x="17" y="20" width="2" height="1" fill="#f0a232" />
      <rect x="21" y="20" width="2" height="1" fill="#d94343" />
      {/* body */}
      <rect x="11" y="22" width="10" height="8" fill="#6d5526" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="13" y="24" width="6" height="4" fill="#f0a232" stroke="#1c1c1c" strokeWidth="0.5" />
      {/* feet */}
      <rect x="10" y="30" width="4" height="2" fill="#1c1c1c" />
      <rect x="18" y="30" width="4" height="2" fill="#1c1c1c" />
    </svg>
  );
}
