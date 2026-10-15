"use client";

import { useEffect, useState } from "react";

function nextUtcMidnight(now: number) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Time left until the next UTC midnight, when a new roll unlocks. */
export function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  let text = "--:--:--";
  if (now !== null) {
    const s = Math.max(0, Math.floor((nextUtcMidnight(now) - now) / 1000));
    text = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  return (
    <p className="text-sm text-zinc-400">
      Next roll in <span className="font-mono tabular-nums text-zinc-200">{text}</span> (midnight UTC)
    </p>
  );
}
