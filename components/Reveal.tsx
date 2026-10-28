"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DigitMatch } from "@/lib/badges/explain";
import { badgeOneIn, formatOdds, percentileLine } from "@/lib/game/odds";
import { sfx, vibrate } from "@/lib/game/sfx";
import { tierColor, tierHype, tierRank } from "@/lib/game/tiers";
import { Chip } from "./Chip";
import { BadgeAura } from "./BadgeAura";
import { Confetti } from "./Confetti";
import { ShareButton } from "./ShareButton";
import { formatNumber, rollLabel, wheelTag, type RollResultData } from "./types";

const SLOTS = 7; // 0 … 1,000,000 fits in seven digits: d,ddd,ddd
// While the digits land, the stage cycles through these colours in a random order,
// so the colour says nothing about the roll. The real tier colour appears at the end.
const CYCLE = ["#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#fb923c", "#ef4444", "#22d3ee"];
const TEASE_MS = 2000; // the last digit teases for every roll alike
const SHAKE_CLASS = ["", "lk-shake-s", "lk-shake-m", "lk-shake", "lk-shake-xl"];

/** The cinematic full-screen roll, then a crossfade back to the page. */
type Phase = "stage" | "closing" | "page";

/** Restart a one-shot CSS animation class on an element. */
function retrigger(el: HTMLElement | null, cls: string, amp?: number) {
  if (!el) return;
  if (amp != null) el.style.setProperty("--amp", String(amp));
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Two hex digits for a 0..1 opacity. */
const hexAlpha = (a: number) =>
  Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, "0");

function randomReel(): string[] {
  return Array.from({ length: SLOTS }, () => String(Math.floor(Math.random() * 10)));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** The roll's digits with the ones that earned a badge lit up. */
function DigitBreakdown({ match, show }: { match: DigitMatch; show: boolean }) {
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-3"
      aria-label={match.whole ? "The whole number earned this badge" : `Digits that earned this badge: ${match.digits.filter((_, i) => match.hit[i]).join(", ")}`}
    >
      {match.digits.map((d, i) => (
        <span
          key={i}
          aria-hidden
          className={`grid h-6 min-w-6 place-items-center rounded px-1 font-mono text-xs font-bold tabular-nums ${
            match.hit[i] ? `bg-zinc-100 text-zinc-900 ${show ? "lk-pop" : ""}` : "bg-zinc-800 text-zinc-500"
          }`}
          style={match.hit[i] ? { animationDelay: `${150 + i * 50}ms` } : undefined}
        >
          {d}
        </span>
      ))}
      {match.whole && match.digits.length > 1 && <span className="ml-1 text-[11px] text-zinc-500">whole number</span>}
    </div>
  );
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
  /** Called once the reveal has finished (straight away when not animating). */
  onDone?: () => void;
}

interface Stage {
  locked: number; // digits locked so far, left to right
  suspense: boolean; // last digit is teasing
  tier: boolean; // tier banner shown
  ep: number; // EP counter value
  badges: number; // badges shown
  done: boolean;
}

/** The roll reveal: a full-screen reel that lands digit by digit, then the result page. */
export function Reveal({ result, animate, newSlugs, streak, onReplay, onDone }: Props) {
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
  const [phase, setPhase] = useState<Phase>(instant ? "page" : "stage");
  // Reduced motion (or a result shown later) skips straight to the end.
  const view: Stage = instant && result ? finalStage(result) : stage;
  const showStage = !instant && phase !== "page";
  const [reel, setReel] = useState<string[]>(() => randomReel());
  const [burst, setBurst] = useState(0); // confetti trigger
  const [shake, setShake] = useState(0); // 0 none … 4 earthquake, when the tier lands
  const [dim, setDim] = useState(false); // the stage goes black while a rare roll teases
  const [flash, setFlash] = useState(0); // full-screen flash trigger
  const [shock, setShock] = useState(0); // shockwave ring trigger (one per landed digit)
  const [cycleAt] = useState(() => Math.floor(Math.random() * CYCLE.length)); // where the colour cycle starts
  const [marks, setMarks] = useState<Record<string, DigitMatch | null>>({}); // which digits earned each badge
  const timers = useRef<number[]>([]);
  const quakeRef = useRef<HTMLDivElement>(null);

  const badges = result ? [...result.badges].sort((a, b) => a.ep - b.ep) : [];
  const digits = result ? String(result.number).padStart(SLOTS, "0").split("") : [];
  const firstSignificant = result ? Math.min(SLOTS - 1, SLOTS - String(result.number).length) : SLOTS;
  const rank = result ? tierRank(result.tier) : 1;
  const color = result ? tierColor(result.tier) : "#8b5cf6";

  // Work out which digits earned each badge (loaded on demand: it pulls in the badge tests).
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    import("@/lib/badges/explain").then(({ explainBadge }) => {
      if (cancelled) return;
      setMarks(Object.fromEntries(result.badges.map((b) => [b.slug, explainBadge(b.slug, result.number)])));
    });
    return () => {
      cancelled = true;
    };
  }, [result]);

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

  // Keep the page still behind the full-screen roll.
  useEffect(() => {
    if (!showStage) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showStage]);

  // Schedule the whole reveal once the result is known.
  useEffect(() => {
    if (!result || instant) return;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const r = tierRank(result.tier);
    // Everything before the tier lands is identical for every roll, so nothing
    // (colour, pause, shake) gives the result away early.
    let t = 500;
    for (let i = 0; i < SLOTS; i++) {
      const last = i === SLOTS - 1;
      const significant = i >= firstSignificant;
      if (last) {
        at(t, () => {
          setStage((s) => ({ ...s, suspense: true }));
          setDim(true);
          sfx.suspense();
        });
        for (let h = 500; h < TEASE_MS - 200; h += 700) at(t + h, () => sfx.heartbeat());
        t += TEASE_MS;
      }
      // Leading zeros drop quickly; every real digit gets a slow, heavy beat.
      t += significant ? 700 + (i - firstSignificant) * 30 : 170;
      const power = 1.1 + (significant ? (i - firstSignificant) * 0.14 : 0);
      at(t, () => {
        setStage((s) => ({ ...s, locked: i + 1, suspense: false }));
        sfx.lock(i);
        if (significant) {
          sfx.thud(power);
          retrigger(quakeRef.current, "lk-quake", 7 + power * 9);
          setShock((k) => k + 1);
          vibrate(Math.round(30 + power * 25));
        }
      });
    }
    t += 800;
    at(t, () => {
      setDim(false);
      setStage((s) => ({ ...s, tier: true }));
      sfx.tier(r);
      if (r >= 4) setBurst((b) => b + 1);
      if (r >= 6) at(450, () => setBurst((b) => b + 1)); // second wave
      if (r >= 5) setFlash((f) => f + 1);
      if (r >= 3) vibrate(r >= 6 ? [80, 40, 80, 40, 80, 40, 300] : r >= 5 ? [60, 40, 60, 40, 180] : [40, 30, 80]);
      const level = r >= 6 ? 4 : r >= 5 ? 3 : r >= 3 ? 2 : r >= 2 ? 1 : 0;
      if (level) {
        setShake(level);
        at(level >= 4 ? 1200 : 700, () => setShake(0));
      }
    });
    // EP count-up: about 1 s, longer for big tiers.
    const steps = 30;
    const tickMs = r >= 5 ? 50 : 36;
    for (let k = 1; k <= steps; k++) {
      const v = Math.round((result.ep * k) / steps);
      at(t + 200 + k * tickMs, () => setStage((s) => ({ ...s, ep: v })));
    }
    t += 200 + steps * tickMs + (r >= 5 ? 1700 : 1200); // hold on the result
    at(t, () => setPhase("closing")); // the stage fades out ...
    at(t + 700, () => setPhase("page")); // ... and is removed
    t += 500;
    const sorted = [...result.badges].sort((a, b) => a.ep - b.ep);
    // Keep long badge lists snappy: about 3.4 s at most for all of them.
    const step = Math.min(420, Math.floor(3800 / Math.max(1, sorted.length)));
    sorted.forEach((b, k) => {
      at(t + k * step, () => {
        setStage((s) => ({ ...s, badges: k + 1 }));
        sfx.badge(tierRank(b.rarity));
      });
    });
    t += sorted.length * step + 200;
    at(t, () => setStage((s) => ({ ...s, done: true })));
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [result, instant, firstSignificant]);

  useEffect(() => {
    if (view.done) onDone?.();
  }, [view.done, onDone]);

  function skip() {
    if (!result || view.done) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setStage(finalStage(result));
    setPhase("page");
    setShake(0);
    setDim(false);
  }

  // Esc skips the roll too.
  useEffect(() => {
    if (!showStage) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStage, result]);

  const tierShown = view.tier && result;

  /** The seven reel slots with commas. `big` gives locked digits the heavy slam. */
  const reelSlots = (big: boolean) =>
    Array.from({ length: SLOTS }, (_, i) => {
      const isLocked = i < view.locked && result;
      const lead = result && i < firstSignificant;
      const teasing = view.suspense && i === SLOTS - 1;
      return (
        <span key={i} className="flex items-end">
          <span
            key={isLocked ? "locked" : "spin"}
            className={
              isLocked
                ? `${big && !lead ? "lk-slam-big" : "lk-lock"} inline-block ${lead ? "text-zinc-700" : "text-zinc-50"}`
                : `inline-block ${teasing ? "lk-tease text-amber-300" : "text-violet-300/80 blur-[1px]"}`
            }
          >
            {isLocked ? digits[i] : reel[i]}
          </span>
          {(i === 0 || i === 3) && <span className={result && firstSignificant > i ? "text-zinc-700" : "text-zinc-500"}>,</span>}
        </span>
      );
    });

  const glow = Math.min(1, view.locked / SLOTS);
  // Tier colour only once the tier has been revealed; before that, a colour that just cycles.
  const stageColor = tierShown ? color : CYCLE[(cycleAt + view.locked * 3) % CYCLE.length];

  return (
    <>
      {/* Screen overlays live outside any shaking box: a transformed parent would trap them. */}
      {burst > 0 && <Confetti key={burst} color={color} rank={rank} />}
      {flash > 0 && (
        <div
          key={flash}
          aria-hidden
          className="lk-flash pointer-events-none fixed inset-0 z-50"
          style={{ background: `radial-gradient(circle at 50% 40%, #ffffff, ${color} 45%, transparent 75%)` }}
        />
      )}

      {/* The full-screen roll. */}
      {showStage && (
        <div
          aria-hidden
          role="presentation"
          onClick={skip}
          className={`fixed inset-0 z-[45] flex cursor-pointer items-center justify-center overflow-hidden transition-opacity duration-500 ${
            phase === "closing" ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          style={{
            background: dim
              ? "#000"
              : `radial-gradient(ellipse at 50% 45%, ${stageColor}${hexAlpha(0.06 + glow * 0.32)} 0%, transparent 66%), #09090b`,
            transition: "background 0.35s, opacity 0.5s",
            ["--tier" as string]: stageColor,
          }}
        >
          <div ref={quakeRef} className={`relative flex w-full flex-col items-center gap-[4vmin] px-3 text-center ${SHAKE_CLASS[shake]}`}>
            {shock > 0 && <span key={shock} className="lk-shockwave" />}
            <p className="relative text-[clamp(0.75rem,1.8vmin,1.1rem)] uppercase tracking-[0.4em] text-zinc-500">
              {result ? `${result.attempt ? rollLabel(result.attempt) : "Your roll"} for ${result.roll_date}` : "Rolling…"}
            </p>
            <p
              className={`relative flex items-end justify-center font-mono text-[clamp(3rem,14vw,13rem)] font-black leading-none tabular-nums ${dim ? "lk-heartbeat" : ""}`}
              style={{ textShadow: result && view.locked > firstSignificant ? `0 0 ${20 + glow * 40}px ${stageColor}88` : undefined }}
            >
              {reelSlots(true)}
            </p>
            <div className={`relative flex min-h-[14vmin] flex-col items-center gap-2 ${tierShown ? "" : "invisible"}`}>
              {tierShown && (
                <>
                  <p className="lk-slam text-[clamp(1.75rem,8vmin,5rem)] font-black uppercase leading-none tracking-[0.2em]" style={{ color, textShadow: `0 0 30px ${color}` }}>
                    {result.tier}
                  </p>
                  <p className="text-[clamp(1.25rem,4vmin,2.5rem)] font-extrabold tabular-nums text-zinc-100">{formatNumber(view.ep)} EP</p>
                  {wheelTag(result.multiplier, result.bonus_ep) && (
                    <p className="lk-fade rounded-full bg-amber-400/15 px-4 py-1 text-sm font-semibold text-amber-300">
                      🎡 Lucky Wheel {wheelTag(result.multiplier, result.bonus_ep)}
                    </p>
                  )}
                  <p className="lk-fade text-sm text-zinc-400">{tierHype(result.tier)}</p>
                </>
              )}
            </div>
          </div>
          <p className="absolute bottom-6 text-xs text-zinc-600">Tap anywhere to skip</p>
        </div>
      )}

      {/* The result page. It fades in as the stage fades out. */}
      <div
        className={`relative flex w-full flex-col items-center gap-6 transition-opacity duration-500 ${phase === "stage" && !instant ? "opacity-0" : "opacity-100"} ${showStage ? "" : SHAKE_CLASS[shake]}`}
        onClick={skip}
        style={{ ["--tier" as string]: color }}
      >
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
            {result ? `${result.attempt ? rollLabel(result.attempt) : "Your roll"} for ${result.roll_date}` : "Rolling…"}
          </p>

          {/* The reel */}
          <p
            className="mt-2 flex items-end justify-center font-mono text-6xl font-bold tabular-nums sm:text-7xl"
            aria-live="polite"
            aria-label={view.done && result ? formatNumber(result.number) : undefined}
          >
            {reelSlots(false)}
          </p>

          {/* Tier + EP */}
          <div className={`mt-5 flex flex-col items-center gap-2 ${tierShown ? "" : "invisible"}`}>
            {tierShown && (
              <>
                <div className="flex items-center gap-3">
                  <Chip value={result.tier} size="lg" />
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color }}>
                    {formatNumber(view.ep)} EP
                  </span>
                </div>
                {wheelTag(result.multiplier, result.bonus_ep) && (
                  <p className="rounded-full bg-amber-400/15 px-3 py-0.5 text-sm font-semibold text-amber-300">
                    🎡 Lucky Wheel {wheelTag(result.multiplier, result.bonus_ep)}
                    {result.base_ep != null && ` · ${formatNumber(result.base_ep)} → ${formatNumber(result.ep)} EP`}
                  </p>
                )}
                <p className="text-sm text-zinc-400">{tierHype(result.tier)}</p>
              </>
            )}
            {!tierShown && <div className="h-[3.75rem]" />}
          </div>
        </div>

        {/* Badges, each in its own aura. */}
        {result && result.badges.length > 0 && (
          <ul className="relative w-full max-w-md space-y-3">
            {badges.map((b, k) => {
              const shown = k < view.badges;
              const odds = badgeOneIn(b.slug);
              const isNew = newSlugs?.has(b.slug);
              return (
                <li key={b.slug} className={shown ? "lk-pop" : "invisible"}>
                  <BadgeAura slug={b.slug} rarity={b.rarity} active={shown}>
                    <div
                      className="rounded-xl border bg-zinc-900/90 px-4 py-3"
                      style={{ borderColor: `${tierColor(b.rarity)}77` }}
                    >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" aria-hidden>
                        {b.emoji}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="flex items-center gap-2 font-semibold text-zinc-100">
                          {b.name}
                          {isNew && (
                            <span className="lk-new rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950">New!</span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">{b.description}</p>
                        {odds && <p className="text-[11px] text-zinc-500">{formatOdds(odds)}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Chip value={b.rarity} />
                        <span className="text-sm font-semibold tabular-nums text-violet-300">+{formatNumber(b.ep)} EP</span>
                      </div>
                    </div>
                    {marks[b.slug] && <DigitBreakdown match={marks[b.slug]!} show={shown} />}
                    </div>
                  </BadgeAura>
                </li>
              );
            })}
          </ul>
        )}
        {result && result.badges.length === 0 && view.tier && phase !== "stage" && (
          <p className="lk-fade text-sm text-zinc-500">No badges this time. Better luck tomorrow.</p>
        )}

        {/* Footer */}
        {result && view.done ? (
          <div className="lk-fade flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-zinc-300">{percentileLine(result.base_ep ?? result.ep)}</p>
            {streak !== undefined && streak > 1 && <p className="text-sm font-semibold text-orange-300">🔥 {streak}-day streak</p>}
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
            </div>
          </div>
        ) : (
          result && phase !== "stage" && <p className="text-xs text-zinc-600">Tap to skip</p>
        )}
      </div>
    </>
  );
}
