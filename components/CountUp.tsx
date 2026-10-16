"use client";

import { useEffect, useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** A number that counts up from zero when it appears. */
export function CountUp({ value, ms = 900, format = fmt }: { value: number; ms?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : ms;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (now - t0) / duration);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
