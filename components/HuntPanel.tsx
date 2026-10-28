"use client";

import { useEffect, useState } from "react";
import { formatOdds } from "@/lib/game/odds";
import { tierColor } from "@/lib/game/tiers";
import { Chip } from "./Chip";
import { HexBadge } from "./HexBadge";
import { formatNumber } from "./types";

export interface HuntStatus {
  available: boolean;
  badge: { slug: string; name: string; emoji: string; description: string; rarity: string; ep: number };
  bonus_ep: number;
  chance: number;
  hit_today: boolean;
  wins: number;
  total_wins: number;
  wins_needed: number;
  max_rerolls: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

function useUntilMidnight() {
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
  if (now === null) return "--:--:--";
  const d = new Date(now);
  const s = Math.max(0, Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function percent(p: number) {
  const v = p * 100;
  return v >= 10 ? `${Math.round(v)}%` : v >= 1 ? `${v.toFixed(1)}%` : `${v.toFixed(2)}%`;
}

/** Today's wanted badge and its bonus. */
export function HuntCard({ hunt }: { hunt: HuntStatus }) {
  const left = useUntilMidnight();
  const b = hunt.badge;
  const color = tierColor(b.rarity);
  const oneIn = hunt.chance > 0 ? Math.max(1, Math.round(1 / hunt.chance)) : null;
  return (
    <section
      className={`w-full max-w-md rounded-2xl border p-4 ${hunt.hit_today ? "border-emerald-400/60 bg-emerald-950/30" : "border-amber-400/60 bg-gradient-to-b from-amber-950/40 to-zinc-900/60"}`}
      style={{ boxShadow: hunt.hit_today ? "0 0 30px rgb(52 211 153 / 0.15)" : "0 0 30px rgb(251 191 36 / 0.12)" }}
      aria-label="Badge hunt"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <h3 className="font-black uppercase tracking-[0.18em] text-amber-300">Badge hunt · wanted today</h3>
        <span className="text-zinc-400">
          Resets in <span className="font-mono font-bold tabular-nums text-zinc-100">{left}</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <HexBadge color={color} size={76} glow>
          {b.emoji}
        </HexBadge>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black tracking-tight">{b.name}</p>
          <p className="text-sm text-zinc-300">{b.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip value={b.rarity} />
            {oneIn && <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-200">about {formatOdds(oneIn)}</span>}
          </div>
        </div>
      </div>
      <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${hunt.hit_today ? "bg-emerald-400/15" : "bg-amber-400/10"}`}>
        <p className="text-sm text-zinc-200">
          {hunt.hit_today ? "You caught it today!" : "Match it today for a bonus of 10× the badge's EP"}
        </p>
        <p className={`shrink-0 text-xl font-black tabular-nums ${hunt.hit_today ? "text-emerald-300" : "text-amber-300"}`}>+{formatNumber(hunt.bonus_ep)} EP</p>
      </div>
    </section>
  );
}

/** Wins towards the free reroll and the Hunter name. */
export function HuntStreak({ hunt }: { hunt: HuntStatus }) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="Hunt wins">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Hunt wins</h3>
        <span className="text-sm text-zinc-400">
          {hunt.wins} of {hunt.wins_needed}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: hunt.wins_needed }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-full ${i < hunt.wins ? "bg-amber-400" : i === hunt.wins ? "border border-dashed border-amber-400" : "bg-zinc-800"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-zinc-400">Win the hunt {hunt.wins_needed} times for a free reroll and the Hunter name glow.</p>
    </section>
  );
}

/** The odds of catching the wanted badge today. */
export function HuntChance({ hunt }: { hunt: HuntStatus }) {
  const p = hunt.chance;
  const withRerolls = 1 - Math.pow(1 - p, 1 + hunt.max_rerolls);
  const bar = (value: number, color: string, scale: number) => (
    <span className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-800">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (value / scale) * 100))}%`, background: color }} />
    </span>
  );
  return (
    <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="Your chance to hit today">
      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Your chance to hit today</h3>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="w-28 text-zinc-200">Daily roll</span>
          {bar(p, "#a78bfa", withRerolls)}
          <span className="w-14 text-right font-bold tabular-nums">{percent(p)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-28 text-zinc-200">With {hunt.max_rerolls} rerolls</span>
          {bar(withRerolls, "#fbbf24", withRerolls)}
          <span className="w-14 text-right font-bold tabular-nums">{percent(withRerolls)}</span>
        </div>
      </div>
    </section>
  );
}
