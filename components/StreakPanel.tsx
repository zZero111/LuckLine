"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "./types";

interface StreakData {
  current: number;
  best: number;
  rolled_today: boolean;
  missed_days: number;
  shield_will_cover: boolean;
  at_risk: boolean;
  shields: { count: number; max: number; price: number; auto: boolean };
  days: { date: string; state: "rolled" | "shield" | "today" | "missed" }[];
  shields_used_in_window: number;
  milestones: { days: number; ep: number; shields: number; cosmetic: string | null; cosmetic_name: string | null; claimed: boolean }[];
}

function ShieldIcon({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" fill="currentColor" />
    </svg>
  );
}

function reward(m: StreakData["milestones"][number]) {
  const parts: string[] = [];
  if (m.shields) parts.push(`+${m.shields} shield`);
  if (m.ep) parts.push(`+${formatNumber(m.ep)} EP`);
  if (m.cosmetic_name) {
    const noun = m.cosmetic?.startsWith("frame") ? "frame" : m.cosmetic?.startsWith("aura") ? "aura" : m.cosmetic?.startsWith("name") ? "name style" : "";
    parts.push(`${m.cosmetic_name} ${noun}`.trim());
  }
  return parts.join(", ");
}

/** The streak page: current streak, the last 14 days, shields and milestones. */
export function StreakPanel() {
  const { user, balance, refreshProfile } = useAuth();
  const [data, setData] = useState<StreakData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const userId = user?.id;
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    createClient()
      .rpc("my_streak")
      .then(({ data: d, error }) => {
        if (cancelled) return;
        if (error || !d) setFailed(true);
        else setData(d as unknown as StreakData);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  if (failed) return <p className="text-rose-300">Could not load your streak.</p>;
  if (!data) return <div className="h-96 lk-shimmer rounded-3xl bg-zinc-900" />;
  const s = data.shields;
  const next = data.milestones.find((m) => !m.claimed);

  async function buy() {
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().rpc("buy_shield");
    if (error) setMessage(error.message.includes("not enough EP") ? "You don't have enough EP yet." : error.message.includes("shields full") ? "You're holding the most shields you can." : "Something went wrong.");
    else sfx.shield();
    await refreshProfile();
    reload();
    setBusy(false);
  }

  async function toggleAuto() {
    sfx.toggle(!s.auto);
    await createClient().rpc("set_shield_auto", { on_off: !s.auto });
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center py-2 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">Current streak</p>
        <p className="flex items-baseline gap-2" aria-label={`${data.current} days`}>
          <span className="text-8xl font-black tabular-nums text-amber-200" style={{ textShadow: "0 0 40px rgb(251 191 36 / 0.45)" }}>
            {data.current}
          </span>
          <span className="text-3xl font-bold text-zinc-300">{data.current === 1 ? "day" : "days"}</span>
        </p>
        <p className="text-zinc-400">
          Best ever: {data.best} {data.best === 1 ? "day" : "days"} ·{" "}
          {data.rolled_today ? "Rolled today ✓" : `Roll today to make it ${data.current + 1}`}
        </p>
        {data.shield_will_cover && <p className="mt-1 text-sm text-sky-300">🛡 A shield will cover the day you missed.</p>}
        {data.at_risk && <p className="mt-1 text-sm text-rose-300">Your streak ended while you were away. Roll to start a new one.</p>}
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4" aria-label="Last 14 days">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400">Last 14 days</h3>
          {data.shields_used_in_window > 0 && <span className="text-sm font-bold text-sky-300">{data.shields_used_in_window} shield used</span>}
        </div>
        <ul className="mt-3 grid grid-cols-7 gap-2">
          {data.days.map((d) => (
            <li key={d.date}>
              <span
                title={`${d.date}: ${d.state}`}
                className={`grid h-14 w-full place-items-center rounded-2xl text-[11px] font-black uppercase ${
                  d.state === "rolled"
                    ? "bg-amber-400"
                    : d.state === "shield"
                      ? "border border-sky-400 bg-sky-900/70 text-sky-300"
                      : d.state === "today"
                        ? "border-2 border-dashed border-violet-400 bg-zinc-950 text-zinc-100"
                        : "border border-zinc-800 bg-zinc-950"
                }`}
              >
                {d.state === "shield" ? <ShieldIcon className="text-sky-400" size={22} /> : d.state === "today" ? "Today" : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-zinc-400">A shield automatically covers missed days so your streak survives.</p>
      </section>

      <section className="rounded-3xl border border-sky-500/40 bg-gradient-to-b from-sky-950/60 to-zinc-900/70 p-4" aria-label="Streak shields">
        <div className="flex items-center gap-3">
          <ShieldIcon className="text-sky-400" size={44} />
          <div className="flex-1">
            <p className="text-xl font-black">
              {s.count} Streak {s.count === 1 ? "Shield" : "Shields"}
            </p>
            <p className="text-sm text-zinc-400">Holds up to {s.max}</p>
          </div>
          <button
            type="button"
            onClick={toggleAuto}
            aria-pressed={s.auto}
            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${s.auto ? "bg-sky-400/20 text-sky-300" : "bg-zinc-800 text-zinc-500"}`}
          >
            Auto-use {s.auto ? "on" : "off"}
          </button>
        </div>
        <button
          type="button"
          disabled={busy || s.count >= s.max || balance < s.price}
          onClick={buy}
          className="mt-3 w-full rounded-2xl border border-sky-400 bg-sky-500/15 px-4 py-3 text-lg font-bold text-sky-200 transition enabled:hover:bg-sky-500/25 enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
        >
          {s.count >= s.max ? "Shields full" : balance < s.price ? `Need ${formatNumber(s.price - balance)} more EP · ${formatNumber(s.price)} EP` : `Buy a shield · ${formatNumber(s.price)} EP`}
        </button>
        {message && (
          <p role="alert" className="mt-2 text-sm text-rose-300">
            {message}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4" aria-label="Milestones">
        <h3 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400">Milestones</h3>
        <ul className="mt-3 flex flex-col gap-3">
          {data.milestones.map((m) => {
            const isNext = next?.days === m.days;
            return (
              <li key={m.days} className={`flex items-center gap-3 ${m.claimed || isNext ? "" : "opacity-55"}`}>
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-lg ${m.claimed ? "border-emerald-400 bg-emerald-400 text-emerald-950" : isNext ? "border-violet-400" : "border-zinc-700"}`}
                  aria-hidden
                >
                  {m.claimed ? "✓" : ""}
                </span>
                <span className="w-24 shrink-0 whitespace-nowrap text-lg font-black">{m.days} days</span>
                <span className="flex-1 text-sm text-zinc-300">{reward(m)}</span>
                <span className={`shrink-0 text-xs font-black uppercase tracking-wider ${m.claimed ? "text-emerald-400" : isNext ? "text-violet-300" : "text-zinc-600"}`}>
                  {m.claimed ? "Claimed" : isNext ? `${Math.max(0, m.days - data.current)} to go` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
