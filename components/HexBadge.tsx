import type { CSSProperties, ReactNode } from "react";

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/** A hexagon with a coloured rim: the badge shape used across the album, hunt and events. */
export function HexBadge({
  color,
  size = 56,
  locked = false,
  dashed = false,
  glow = false,
  children,
  className = "",
  style,
}: {
  color: string;
  size?: number;
  locked?: boolean;
  /** Draw the rim dashed (an unfound badge). */
  dashed?: boolean;
  glow?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const rim = locked ? "#3f3f46" : color;
  const fill = locked ? "#18181b" : `color-mix(in srgb, ${color} 18%, #09090b)`;
  const t = Math.max(2, Math.round(size / 24));
  return (
    <span
      aria-hidden
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size, filter: glow && !locked ? `drop-shadow(0 0 ${size / 5}px ${color}99)` : undefined, ...style }}
    >
      {dashed ? (
        <svg viewBox="0 0 100 100" className="absolute inset-0" width={size} height={size}>
          <polygon points="50,2 98,26 98,74 50,98 2,74 2,26" fill={fill} stroke={rim} strokeWidth="4" strokeDasharray="7 6" strokeLinejoin="round" />
        </svg>
      ) : (
        <>
          <span className="absolute inset-0" style={{ clipPath: HEX, background: rim }} />
          <span className="absolute" style={{ clipPath: HEX, background: fill, inset: t }} />
        </>
      )}
      <span className="relative grid place-items-center leading-none" style={{ fontSize: size * 0.42 }}>
        {children}
      </span>
    </span>
  );
}
