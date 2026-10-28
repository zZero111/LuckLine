"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { changePct, dayMonth, ordinal, renderRecapPng, weekday, type Recap } from "@/lib/game/recapImage";
import { sfx } from "@/lib/game/sfx";
import { tierColor, tierSquare } from "@/lib/game/tiers";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { capitalize } from "./Chip";
import { CountUp } from "./CountUp";
import { formatNumber } from "./types";

function shareText(r: Recap, name: string, url: string) {
  const pct = changePct(r);
  const lines = [
    `Luckline · week ${r.week_number} recap 🎲`,
    r.days.map((d) => (d.tier ? tierSquare(d.tier) : "⬛")).join(""),
    `${formatNumber(r.total_ep)} EP${pct !== null ? ` (${pct >= 0 ? "+" : ""}${pct}% vs last week)` : ""}`,
  ];
  if (r.best) lines.push(`Best roll ${formatNumber(r.best.number)} (${r.best.tier})`);
  if (r.rarest_badge) lines.push(`Rarest badge: ${r.rarest_badge.name} (1 in ${formatNumber(r.rarest_badge.one_in)})`);
  lines.push(`🔥 ${r.streak}-day streak${r.rank ? ` · ${ordinal(r.rank)} this week` : ""}`);
  lines.push(`${name} on Luckline`, url);
  return lines.join("\n");
}

/** This week's (or an earlier week's) summary as a shareable card. */
export function WeeklyRecap() {
  const { user, displayName } = useAuth();
  const [weekBack, setWeekBack] = useState(0);
  const [recap, setRecap] = useState<{ key: string; data: Recap } | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const userId = user?.id;
  const key = `${userId}:${weekBack}`;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    createClient()
      .rpc("weekly_recap", { week_back: weekBack })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setFailed(true);
        else {
          setFailed(false);
          setRecap({ key, data: data as unknown as Recap });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, weekBack, key]);

  if (failed) return <p className="text-rose-300">Could not load your recap.</p>;
  if (!recap || recap.key !== key) return <div className="h-96 lk-shimmer rounded-3xl bg-zinc-900" />;
  const r = recap.data;
  const pct = changePct(r);
  const name = displayName ?? "Player";

  async function share() {
    sfx.click();
    const text = shareText(r, name, `${window.location.origin}${BASE_PATH}/`);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setNote("Copied to your clipboard.");
      }
    } catch {
      // Sharing cancelled: nothing to do.
    }
  }

  async function save() {
    sfx.click();
    try {
      const blob = await renderRecapPng(r, name);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `luckline-week-${r.week_number}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
      setNote("Saved.");
    } catch {
      setNote("Couldn't make the image on this device.");
    }
  }

  const tile = (label: string, value: string, sub: string, subColor: string, i: number) => (
    <div className="lk-card rounded-2xl border border-white/15 bg-black/50 p-4" style={{ ["--i" as string]: i }}>
      <p className="text-sm text-zinc-300">{label}</p>
      <p className="mt-1 truncate text-2xl font-black tracking-tight">{value}</p>
      <p className="text-sm font-bold" style={{ color: subColor }}>
        {sub}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            sfx.click();
            setWeekBack((w) => w + 1);
            setNote(null);
          }}
          className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800"
        >
          ← Earlier week
        </button>
        {weekBack > 0 && (
          <button
            type="button"
            onClick={() => {
              sfx.click();
              setWeekBack((w) => Math.max(0, w - 1));
              setNote(null);
            }}
            className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800"
          >
            Later week →
          </button>
        )}
      </div>

      <article
        className="lk-pop relative overflow-hidden rounded-3xl border border-violet-500/60 bg-gradient-to-br from-violet-800/80 via-indigo-950 to-zinc-950 p-5"
        aria-label={`Week ${r.week_number} recap`}
      >
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-violet-400/30 blur-3xl" />
        <div className="relative flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-violet-200">
            Week {r.week_number} recap{r.is_current ? " · so far" : ""}
          </h2>
          <p className="text-sm text-zinc-400">
            {dayMonth(r.week_start)} to {dayMonth(r.week_end)}
          </p>
        </div>
        <p className="relative mt-4 text-lg text-zinc-200">Total EP this week</p>
        <p className="relative text-6xl font-black tabular-nums tracking-tight">
          <CountUp value={r.total_ep} />
        </p>
        {pct !== null && (
          <p className={`relative mt-1 text-lg font-bold ${pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {pct >= 0 ? `Up ${pct}% on last week` : `Down ${Math.abs(pct)}% on last week`}
          </p>
        )}

        <h3 className="relative mt-5 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Your seven rolls</h3>
        <ul className="relative mt-2 grid grid-cols-7 gap-2">
          {r.days.map((d) => (
            <li key={d.date} className="flex flex-col items-center gap-1">
              <span
                className="h-12 w-full rounded-xl"
                style={{ background: d.tier ? tierColor(d.tier) : "#27243d" }}
                title={d.ep != null ? `${weekday(d.date)}: ${formatNumber(d.number ?? 0)} (${d.ep} EP)` : `${weekday(d.date)}: no roll`}
              />
              <span className="text-xs text-zinc-400">{weekday(d.date)}</span>
            </li>
          ))}
        </ul>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          {tile(
            "Best roll",
            r.best ? formatNumber(r.best.number) : "None yet",
            r.best ? `${capitalize(r.best.tier)} · ${weekday(r.best.date)}` : "Roll to get on the board",
            r.best ? tierColor(r.best.tier) : "#a1a1aa",
            0,
          )}
          {tile(
            "Rarest badge",
            r.rarest_badge ? r.rarest_badge.name : "None yet",
            r.rarest_badge ? `1 in ${formatNumber(r.rarest_badge.one_in)}` : "",
            "#a78bfa",
            1,
          )}
          {tile("Streak", `${r.streak} ${r.streak === 1 ? "day" : "days"}`, r.shields_used ? `${r.shields_used} shield used` : "Keep it going", "#38bdf8", 2)}
          {tile("Rank this week", r.rank ? ordinal(r.rank) : "None yet", r.players ? `of ${formatNumber(r.players)} ${r.players === 1 ? "player" : "players"}` : "", "#34d399", 3)}
        </div>

        <div className="relative mt-5 flex items-baseline justify-between gap-2 border-t border-white/15 pt-3 text-sm">
          <p className="font-bold text-zinc-100">{name} on Luckline</p>
          {r.luckier_than_pct !== null && <p className="text-zinc-400">Luckier than {r.luckier_than_pct}% of players</p>}
        </div>
      </article>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={share} className="rounded-2xl bg-violet-600 px-4 py-3 text-lg font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 active:scale-95">
          Share recap
        </button>
        <button type="button" onClick={save} className="rounded-2xl border border-zinc-700 px-4 py-3 text-lg font-bold text-zinc-100 transition hover:bg-zinc-900 active:scale-95">
          Save as image
        </button>
      </div>
      <p className="text-center text-sm text-zinc-500" role="status">
        {note ?? "Weeks run Monday to Sunday (UTC). Your day score is your best roll of the day."}
      </p>
    </div>
  );
}
