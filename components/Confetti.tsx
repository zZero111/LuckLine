"use client";

import { useState } from "react";

interface Piece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  size: number;
  color: string;
  round: boolean;
}

const PALETTE = ["#ffffff", "#fde68a", "#a78bfa", "#38bdf8", "#34d399", "#fb7185"];

/** One-shot CSS confetti burst. More pieces for higher tiers. */
export function Confetti({ color, rank }: { color: string; rank: number }) {
  const [pieces] = useState<Piece[]>(() => {
    const count = rank >= 6 ? 160 : rank >= 5 ? 110 : 70;
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.8 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 240,
      spin: (Math.random() - 0.5) * 1440,
      size: 6 + Math.random() * 8,
      color: Math.random() < 0.55 ? color : PALETTE[Math.floor(Math.random() * PALETTE.length)],
      round: Math.random() < 0.3,
    }));
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="lk-confetti absolute top-[-20px] block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
