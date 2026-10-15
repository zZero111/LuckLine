"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { badgeOneIn, formatOdds, percentileLine } from "@/lib/game/odds";
import { sfx, vibrate } from "@/lib/game/sfx";
import { tierColor, tierHype, tierRank } from "@/lib/game/tiers";
import { Chip } from "./Chip";
import { Confetti } from "./Confetti";
import { ShareButton } from "./ShareButton";
import { SoundToggle } from "./SoundToggle";
import { formatNumber, type RollResultData } from "./types";

const SLOTS = 7; // 0 … 1,000,000 fits in seven digits: d,ddd,ddd

function randomReel(): string[] {
  return Array.from({ length: SLOTS }, () => String(Math.floor(Math.random() * 10)));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  /** null while the roll request is still in flight (the reel keeps spinning). */
  result: RollResultData | null;
  /** false renders the finished state straight away. */
  animate: boolean;
  /** Badge slugs earned for the first time with this roll. */
  newSlugs?: ReadonlySet<string>;
  /** Consecutive UTC days rolled, including this one. */
  streak?: number;
  onReplay?: () => void;
}

interface Stage {
  locked: number; // digits locked so far, left to right
  suspense: boolean; // last digit is teasing
  tier: boolean; // tier banner shown
  ep: number; // EP counter value
  badges: number; // badges shown
  done: boolean;
}

/** The roll reveal: spinning reel, digit locks, tier slam, EP count-up, badges. */
export function Reveal({ result, animate, newSlugs, streak, onReplay }: Props) {
  const instant = !animate || prefersReducedMotion();
  const finalStage = useCallback(
    (r: RollResultData | null): Stage => ({
      locked: SLOTS,
      suspense: false,
      tier: true,
      ep: r?.ep ?? 0,
      badges: r?.badges.length ?? 0,
      done: true,
    }),
    [],
  );
  const [stage, setStage] = useState<Stage>(() =>
    instant && result ? finalStage(result) : { locked: 0, suspense: false, tier: false, ep: 0, badges: 0, done: false },
  );
  // Reduced motion (or a result shown later) skips straight to the end.
  const view: Stage = instant && result ? finalStage(result) : stage;
  const [reel, setReel] = useState<string[]>(() => randomReel());
  const [burst, setBurst] = useState(0); // confetti trigger
  const [shake, setShake] = useState(false);
  const timers = useRef<number[]>([]);

  // Badges in ascending EP so the best one lands last.
  const badges = result ? [...result.badges].sort((a, b) => a.ep - b.ep) : [];
  const digits = result ? String(result.number).padStart(SLOTS, "0").split("") : [];
  const firstSignificant = result ? Math.min(SLOTS - 1, SLOTS - String(result.number).length) : SLOTS;
  const rank = result ? tierRank(result.tier) : 1;
  const color = result ? tierColor(result.tier) : "#8b5cf6";

  // Spin the unlocked slots.
  useEffect(() => {
    if (view.locked >= SLOTS) return;
    let n = 0;
    const id = window.setInterval(() => {
      setReel(randomReel());
      if (animate && n++ % 2 === 0) sfx.tick();
    }, 60);
    return () => window.clearInterval(id);
  }, [view.locked, animate]);

  // Schedule the reveal once the result is known.
  useEffect(() => {
    if (!result || instant) return;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const r = tierRank(result.tier);
    let t = 250;
    for (let i = 0; i < SLOTS; i++) {
      const last = i === SLOTS - 1;
      if (last && r >= 3) {
        at(t, () => {
          setStage((s) => ({ ...s, suspense: true }));
          sfx.suspense();
        });
        t += r >= 4 ? 1200 : 750;
      }
      // Leading zeros lock quickly; real digits get a beat each.
      t += i < firstSignificant ? 90 : 190;
      at(t, () => {
        setStage((s) => ({ ...s, locked: i + 1, suspense: false }));
        sfx.lock(i);
      });
    }
    t += 380;
    at(t, () => {
      setStage((s) => ({ ...s, tier: true }));
      sfx.tier(r);
      if (r >= 4) setBurst((b) => b + 1);
      if (r >= 3) vibrate(r >= 5 ? [60, 40, 60, 40, 180] : [40, 30, 80]);
      if (r >= 6) {
        setShake(true);
        at(700, () => setShake(false));
      }
    });
    // EP count-up over ~800ms.
    const steps = 24;
    for (let k = 1; k <= steps; k++) {
      const v = Math.round((result.ep * k) / steps);
      at(t + 150 + k * 33, () => setStage((s) => ({ ...s, ep: v })));
    }
    t += 150 + steps * 33 + 250;
    const sorted = [...result.badges].sort((a, b) => a.ep - b.ep);
    sorted.forEach((b, k) => {
      at(t + k * 340, () => {
        setStage((s) => ({ ...s, badges: k + 1 }));
        sfx.badge(tierRank(b.rarity));
      });
    });
    t += sorted.length * 340 + 200;
    at(t, () => setStage((s) => ({ ...s, done: true })));
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [result, instant, firstSignificant]);

  function skip() {
    if (!result || view.done) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setStage(finalStage(result));
    setShake(false);
  }

  const tierShown = view.tier && result;

  return (
    <div
      className={`relative flex w-full flex-col items-center gap-6 ${shake ? "lk-shake" : ""}`}
      onClick={skip}
      style={{ ["--tier" as string]: color }}
    >
      {burst > 0 && <Confetti key={burst} color={color} rank={rank} />}

      {/* Glow behind the number once the tier lands. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-10 left-1/2 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
          tierShown && rank >= 2 ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: `radial-gradient(closest-side, ${color}55, transparent)` }}
      />

      <div className="relative text-center">
        <p className="text-sm uppercase tracking-widest text-zinc-500">
          {result ? `Your roll for ${result.roll_date}` : "Rolling…"}
        </p>

        {/* The reel */}
        <p
          className="mt-2 flex items-end justify-center font-mono text-6xl font-bold tabular-nums sm:text-7xl"
          aria-live="polite"
          aria-label={view.done && result ? formatNumber(result.number) : undefined}
        >
          {Array.from({ length: SLOTS }, (_, i) => {
            const isLocked = i < view.locked && result;
            const lead = result && i < firstSignificant;
            const teasing = view.suspense && i === SLOTS - 1;
            return (
              <span key={i} className="flex items-end">
                <span
                  key={isLocked ? "locked" : "spin"}
                  className={
                    isLocked
                      ? `lk-lock inline-block ${lead ? "text-zinc-700" : "text-zinc-50"}`
                      : `inline-block ${teasing ? "lk-tease text-amber-300" : "text-violet-300/80 blur-[1px]"}`
                  }
                >
                  {isLocked ? digits[i] : reel[i]}
                </span>
                {(i === 0 || i === 3) && (
                  <span className={result && firstSignificant > i ? "text-zinc-700" : "text-zinc-500"}>,</span>
                )}
              </span>
            );
          })}
        </p>

        {/* Tier + EP */}
        <div className={`mt-5 flex flex-col items-center gap-2 ${tierShown ? "" : "invisible"}`}>
          {tierShown && (
            <>
              <div className="lk-slam flex items-center gap-3">
                <Chip value={result.tier} size="lg" />
                <span className="text-2xl font-extrabold tabular-nums" style={{ color }}>
                  {formatNumber(view.ep)} EP
                </span>
              </div>
              <p className="lk-fade text-sm text-zinc-400">{tierHype(result.tier)}</p>
            </>
          )}
          {!tierShown && <div className="h-[3.75rem]" />}
        </div>
      </div>

      {/* Badges */}
      {result && result.badges.length > 0 && (
        <ul className="relative w-full max-w-md space-y-2">
          {badges.map((b, k) => {
            const shown = k < view.badges;
            const odds = badgeOneIn(b.slug);
            const isNew = newSlugs?.has(b.slug);
            return (
              <li
                key={b.slug}
                className={`flex items-center gap-3 rounded-xl border bg-zinc-900/70 px-4 py-3 ${
                  shown ? "lk-pop" : "invisible"
                }`}
                style={{ borderColor: `${tierColor(b.rarity)}66`, boxShadow: shown && tierRank(b.rarity) >= 4 ? `0 0 24px -6px ${tierColor(b.rarity)}` : undefined }}
              >
                <span className="text-3xl" aria-hidden>
                  {b.emoji}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="flex items-center gap-2 font-semibold text-zinc-100">
                    {b.name}
                    {isNew && (
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950">
                        New!
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{b.description}</p>
                  {odds && <p className="text-[11px] text-zinc-500">{formatOdds(odds)}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Chip value={b.rarity} />
                  <span className="text-sm font-semibold tabular-nums text-violet-300">+{b.ep} EP</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {result && result.badges.length === 0 && view.tier && (
        <p className="lk-fade text-sm text-zinc-500">No badges this time. Better luck tomorrow.</p>
      )}

      {/* Footer */}
      {result && view.done ? (
        <div className="lk-fade flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-zinc-300">{percentileLine(result.ep)}</p>
          {streak !== undefined && streak > 1 && (
            <p className="text-sm font-semibold text-orange-300">🔥 {streak}-day streak</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ShareButton result={result} streak={streak} />
            {onReplay && (
              <button
                type="button"
                onClick={onReplay}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                ↻ Replay reveal
              </button>
            )}
            <SoundToggle />
          </div>
        </div>
      ) : (
        result && <p className="text-xs text-zinc-600">Tap to skip</p>
      )}
    </div>
  );
}
