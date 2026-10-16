/** The Luckline die. Same artwork as app/icon.svg (the browser-tab icon). */
export function DiceLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="lk-die-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <g transform="rotate(-12 32 32)">
        <rect x="8" y="10" width="48" height="48" rx="12" fill="#4c1d95" />
        <rect x="8" y="6" width="48" height="48" rx="12" fill="url(#lk-die-face)" />
        <rect x="11" y="9" width="42" height="10" rx="5" fill="#ffffff" opacity="0.18" />
        <g fill="#ffffff">
          <circle cx="20" cy="18" r="4.6" />
          <circle cx="44" cy="18" r="4.6" />
          <circle cx="32" cy="30" r="4.6" />
          <circle cx="20" cy="42" r="4.6" />
          <circle cx="44" cy="42" r="4.6" />
        </g>
      </g>
    </svg>
  );
}
