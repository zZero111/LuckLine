"use client";

import { useEffect, useRef } from "react";
import { DiceLogo } from "./DiceLogo";

interface Props {
  size?: number;
  /** Idle spin speed in degrees per second. */
  speed?: number;
  /** Spin faster (like on hover). The change eases in and out. */
  fast?: boolean;
  /** Increase to give the die a whirl that gradually slows back down. */
  kick?: number;
  className?: string;
}

/** The Luckline die, turning slowly. Speed changes ease in and out. */
export function SpinningDie({ size = 30, speed = 45, fast = false, kick = 0, className = "" }: Props) {
  const el = useRef<HTMLSpanElement>(null);
  const motion = useRef({ angle: 0, vel: speed, impulse: 0, fast });

  useEffect(() => {
    motion.current.fast = fast;
  }, [fast]);

  useEffect(() => {
    if (kick > 0) motion.current.impulse = 1300;
  }, [kick]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      m.impulse *= Math.pow(0.18, dt); // a kick fades over about a second
      const target = (m.fast ? speed * 7 : speed) + m.impulse;
      m.vel += (target - m.vel) * Math.min(1, dt * 5);
      m.angle = (m.angle + m.vel * dt) % 360;
      if (el.current) el.current.style.transform = `rotate(${m.angle.toFixed(2)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <span ref={el} className="inline-block shrink-0" style={{ width: size, height: size, willChange: "transform" }}>
      <DiceLogo size={size} className={className} />
    </span>
  );
}
