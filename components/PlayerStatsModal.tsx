"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";
import { Chip } from "./Chip";
import { formatNumber, wheelTag } from "./types";

interface Stats {
  display_name: string;
  avatar_path: string | null;
  joined: string;
  days_played: number;
  total_rolls: number;
  total_ep: number;
  rank_all_time: number | null;
  best: { number: number; ep: number; tier: string; roll_date: string; multiplier: number; attempt: number } | null;
  badges_collected: number;
  badges_total: number;
  rarest_badge: { name: string; emoji: string; rarity: string; ep: number } | null;
  current_streak: number;
  longest_streak: number;
  wheel_spins: number;
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

/** Summary stats for one player, opened from the leaderboard. */
export function PlayerStatsModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .rpc("player_stats", { target_name: name })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setFailed(true);
        else setStats(data as unknown as Stats);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const pct = stats ? Math.round((100 * stats.badges_collected) / Math.max(1, stats.badges_total)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s stats`}
        className="lk-pop relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="flex items-center gap-4">
          <Avatar path={stats?.avatar_path} name={name} size={64} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold">{name}</h2>
            {stats && (
              <p className="text-sm text-zinc-400">
                {stats.rank_all_time ? `#${stats.rank_all_time} all-time · ` : ""}playing since {stats.joined}
              </p>
            )}
          </div>
        </div>

        {failed ? (
          <p className="mt-6 text-rose-300">Couldn&apos;t load this player&apos;s stats.</p>
        ) : !stats ? (
          <div className="mt-6 h-48 animate-pulse rounded-xl bg-zinc-900" />
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {stats.best && (
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
                <p className="text-[11px] uppercase tracking-wide text-amber-300/80">Best roll ever</p>
                <p className="mt-1 font-mono text-4xl font-bold tabular-nums">{formatNumber(stats.best.number)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Chip value={stats.best.tier} />
                  <span className="font-semibold text-violet-300">{formatNumber(stats.best.ep)} EP</span>
                  {wheelTag(stats.best.multiplier) && (
                    <span className="text-amber-300">🎡{wheelTag(stats.best.multiplier)}</span>
                  )}
                  <span className="text-zinc-500">
                    on {stats.best.roll_date}
                    {stats.best.attempt > 0 ? ` (reroll ${stats.best.attempt})` : ""}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label="Total score" value={formatNumber(stats.total_ep)} sub="EP, best roll per day" />
              <Tile label="Current streak" value={`🔥 ${stats.current_streak}`} sub={stats.current_streak === 1 ? "day" : "days"} />
              <Tile label="Longest streak" value={stats.longest_streak} sub="days" />
              <Tile label="Days played" value={formatNumber(stats.days_played)} />
              <Tile label="Total rolls" value={formatNumber(stats.total_rolls)} sub="incl. rerolls" />
              <Tile label="Wheel spins" value={formatNumber(stats.wheel_spins)} />
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Badges collected</p>
                <p className="text-sm tabular-nums text-zinc-300">
                  <span className="text-lg font-bold text-zinc-50">{stats.badges_collected}</span> / {stats.badges_total}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${pct}%` }} />
              </div>
              {stats.rarest_badge && (
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-2xl">{stats.rarest_badge.emoji}</span>
                  <span className="text-zinc-400">Rarest:</span>
                  <span className="font-semibold">{stats.rarest_badge.name}</span>
                  <Chip value={stats.rarest_badge.rarity} />
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
