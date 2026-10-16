"use client";

import { useEffect, useRef } from "react";

interface Props {
  size?: number;
  /** Idle tumble speed in degrees per second (on the fastest axis). */
  speed?: number;
  /** Tumble faster (like on hover). The change eases in and out. */
  fast?: boolean;
  /** Increase to give the die a whirl that gradually slows back down. */
  kick?: number;
  className?: string;
}

// Opposite faces add up to 7, like a real die. [pip count, face transform]
const FACES: [number, string][] = [
  [1, "rotateY(0deg)"],
  [6, "rotateY(180deg)"],
  [2, "rotateY(90deg)"],
  [5, "rotateY(-90deg)"],
  [3, "rotateX(90deg)"],
  [4, "rotateX(-90deg)"],
];

// Which cells of a 3x3 grid hold a pip for each number.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Slightly different shading per face so the cube reads as solid.
const SHADE = [1, 0.62, 0.86, 0.74, 1.12, 0.55];

/** A real 3D die tumbling on all three axes. Hover speeds it up; a kick makes it whirl. */
export function SpinningDie({ size = 30, speed = 45, fast = false, kick = 0, className = "" }: Props) {
  const cube = useRef<HTMLDivElement>(null);
  const motion = useRef({ x: -24, y: 38, z: 0, impulse: 0, boost: 0, fast });

  useEffect(() => {
    motion.current.fast = fast;
  }, [fast]);

  useEffect(() => {
    if (kick > 0) motion.current.impulse = 1400;
  }, [kick]);

  useEffect(() => {
    const draw = () => {
      const m = motion.current;
      if (cube.current) cube.current.style.transform = `rotateX(${m.x.toFixed(1)}deg) rotateY(${m.y.toFixed(1)}deg) rotateZ(${m.z.toFixed(1)}deg)`;
    };
    draw();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      m.impulse *= Math.pow(0.2, dt); // a kick fades over about a second
      const target = (m.fast ? 6 : 1) + m.impulse / Math.max(1, speed);
      m.boost += (target - m.boost) * Math.min(1, dt * 5);
      // Three different rates, so the die never repeats the same tumble.
      m.x = (m.x + speed * 0.9 * m.boost * dt) % 360;
      m.y = (m.y + speed * 1.15 * m.boost * dt) % 360;
      m.z = (m.z + speed * 0.5 * m.boost * dt) % 360;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const half = size / 2;
  const pip = Math.max(2.2, size * 0.15);
  const radius = size * 0.2;

  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size, perspective: size * 5 }}
    >
      <div ref={cube} style={{ width: size, height: size, position: "relative", transformStyle: "preserve-3d", willChange: "transform" }}>
        {/* Solid core so the rounded corners never show daylight. */}
        {["rotateY(0deg)", "rotateY(90deg)", "rotateX(90deg)"].map((t) => (
          <div key={t} style={{ position: "absolute", inset: size * 0.06, background: "#4c1d95", transform: t }} />
        ))}
        {FACES.map(([n, t], i) => (
          <div
            key={n}
            style={{
              position: "absolute",
              inset: 0,
              transform: `${t} translateZ(${half}px)`,
              borderRadius: radius,
              background: "linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 55%, #6d28d9 100%)",
              filter: `brightness(${SHADE[i]})`,
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18), inset 0 -2px 4px rgb(76 29 149 / 0.5)",
              display: "grid",
              gridTemplate: "repeat(3, 1fr) / repeat(3, 1fr)",
              padding: size * 0.16,
              backfaceVisibility: "hidden",
            }}
          >
            {Array.from({ length: 9 }, (_, cell) => (
              <span key={cell} style={{ display: "grid", placeItems: "center" }}>
                {PIPS[n].includes(cell) && (
                  <span style={{ width: pip, height: pip, borderRadius: "50%", background: "#fff", boxShadow: "inset 0 -1px 1px rgb(76 29 149 / 0.4)" }} />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </span>
  );
}
