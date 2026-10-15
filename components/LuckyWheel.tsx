"use client";

import { useEffect, useRef, useState } from "react";
import { sfx, vibrate } from "@/lib/game/sfx";
import { Confetti } from "./Confetti";
import { formatNumber, rollLabel, type WheelPrize, type WheelSpin } from "./types";

const SIZE = 300;
const R = SIZE / 2;
const SPIN_SPEED = 0.9; // degrees per ms while waiting for the server

interface Slice {
  prize: WheelPrize;
  start: number; // degrees clockwise from the top
  end: number;
}

function slicesFor(prizes: WheelPrize[]): Slice[] {
  const total = prizes.reduce((t, p) => t + p.weight, 0);
  let at = 0;
  return prizes.map((prize) => {
    const start = at;
    at += (360 * prize.weight) / total;
    return { prize, start, end: at };
  });
}

function point(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [R + r * Math.cos(rad), R + r * Math.sin(rad)];
}

function arc(s: Slice) {
  const [x1, y1] = point(s.start, R - 4);
  const [x2, y2] = point(s.end, R - 4);
  const large = s.end - s.start > 180 ? 1 : 0;
  return `M ${R} ${R} L ${x1} ${y1} A ${R - 4} ${R - 4} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** Wheel-angle under the pointer for a rotation of `rot` degrees. */
const underPointer = (rot: number) => (((-rot % 360) + 360) % 360);

export interface SpinOutcome {
  prize: WheelPrize;
  attempt: number;
  ep_before: number;
  ep_after: number;
  balance?: number;
}

interface Props {
  prizes: WheelPrize[];
  /** Today's spin if already used. */
  spin: WheelSpin | null;
  /** Latest roll the spin would apply to. */
  target: { attempt: number; number: number; ep: number } | null;
  /** Calls spin_wheel(); resolves with the outcome or rejects with a message. */
  onSpin: () => Promise<SpinOutcome>;
  /** Called after the wheel has stopped and the result is shown. */
  onSettled: (outcome: SpinOutcome) => void;
}

/** One spin a day. The prize is chosen by the server; the wheel just lands on it. */
export function LuckyWheel({ prizes, spin, target, onSpin, onSettled }: Props) {
  const slices = slicesFor(prizes);
  const group = useRef<SVGGElement>(null);
  const rotation = useRef(0);
  const frame = useRef<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landed">(spin ? "landed" : "idle");
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  const setRotation = (deg: number) => {
    rotation.current = deg;
    if (group.current) group.current.style.transform = `rotate(${deg}deg)`;
  };

  // Show an already-used spin pointing at its prize.
  useEffect(() => {
    // Skip when this visit's own spin just landed: the wheel is already there.
    if (!spin || outcome) return;
    const s = slices.find((x) => x.prize.id === spin.prize_id);
    if (s) setRotation(-(s.start + s.end) / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.prize_id]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  async function start() {
    if (phase !== "idle" || !target) return;
    sfx.unlock();
    setError(null);
    setPhase("spinning");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Free spin until the server answers.
    let last = performance.now();
    let lastTick = Math.floor(rotation.current / 15);
    const free = (now: number) => {
      setRotation(rotation.current + (now - last) * SPIN_SPEED);
      last = now;
      const t = Math.floor(rotation.current / 15);
      if (t !== lastTick) {
        lastTick = t;
        sfx.tick();
      }
      frame.current = requestAnimationFrame(free);
    };
    if (!reduced) frame.current = requestAnimationFrame(free);

    let result: SpinOutcome;
    try {
      result = await onSpin();
    } catch (e) {
      if (frame.current) cancelAnimationFrame(frame.current);
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      return;
    }

    const slice = slices.find((x) => x.prize.id === result.prize.id)!;
    // Land somewhere inside the slice, not always dead centre.
    const width = slice.end - slice.start;
    const targetAngle = slice.start + width * (0.2 + 0.6 * Math.random());
    const from = rotation.current;
    const turns = 3 * 360;
    const delta = ((underPointer(from) - targetAngle + 360) % 360) + turns;
    const to = from + delta;
    const duration = Math.min(5200, Math.max(3200, (3 * delta) / SPIN_SPEED));

    const land = () => {
      setPhase("landed");
      setOutcome(result);
      const k = result.prize;
      if (k.kind === "multiplier" && k.value < 1) {
        sfx.tier(0);
      } else {
        const rank = k.kind === "multiplier" ? (k.value >= 10 ? 6 : k.value >= 5 ? 5 : k.value >= 3 ? 4 : 3) : k.kind === "nothing" ? 1 : 3;
        sfx.tier(rank);
        if (rank >= 4) setBurst((b) => b + 1);
        if (rank >= 3) vibrate(rank >= 5 ? [60, 40, 60, 40, 180] : [40, 30, 80]);
      }
      onSettled(result);
    };

    if (frame.current) cancelAnimationFrame(frame.current);
    if (reduced) {
      setRotation(to);
      land();
      return;
    }
    const t0 = performance.now();
    let tick = Math.floor(from / 15);
    const ease = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setRotation(from + delta * eased);
      const t = Math.floor(rotation.current / 15);
      if (t !== tick) {
        tick = t;
        sfx.tick();
      }
      if (p < 1) frame.current = requestAnimationFrame(ease);
      else land();
    };
    frame.current = requestAnimationFrame(ease);
  }

  const shownPrize =
    outcome?.prize ?? (spin ? prizes.find((p) => p.id === spin.prize_id) ?? null : null);
  const shownResult = outcome ?? (spin ? { attempt: spin.attempt, ep_before: spin.ep_before, ep_after: spin.ep_after } : null);
  const total = prizes.reduce((t, p) => t + p.weight, 0);

  return (
    <div className="lk-fade flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      {burst > 0 && <Confetti key={burst} color={shownPrize?.color ?? "#facc15"} rank={shownPrize?.value && shownPrize.value >= 10 ? 6 : 5} />}
      <div className="text-center">
        <p className="text-lg font-bold">🎡 Lucky Wheel</p>
        <p className="text-xs text-zinc-500">
          One spin a day. It changes your latest roll
          {target ? (
            <>
              {" "}({rollLabel(target.attempt)}: <span className="font-mono">{formatNumber(target.number)}</span>,{" "}
              {formatNumber(target.ep)} EP)
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Pointer */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-amber-300 drop-shadow"
        />
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label="Lucky wheel">
          <g ref={group} style={{ transformOrigin: "50% 50%" }}>
            {slices.map((s) => {
              const mid = (s.start + s.end) / 2;
              const [tx, ty] = point(mid, R * 0.62);
              const big = s.end - s.start >= 14;
              return (
                <g key={s.prize.id}>
                  <path d={arc(s)} fill={s.prize.color} stroke="#09090b" strokeWidth={2} />
                  {big && (
                    <text
                      x={tx}
                      y={ty}
                      fill="#fafafa"
                      fontSize={s.end - s.start > 40 ? 13 : 10}
                      fontWeight={700}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${mid} ${tx} ${ty})`}
                    >
                      {s.prize.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <circle cx={R} cy={R} r={26} fill="#18181b" stroke="#fcd34d" strokeWidth={3} />
          <text x={R} y={R} fill="#fcd34d" fontSize={18} textAnchor="middle" dominantBaseline="central">
            ★
          </text>
        </svg>
      </div>

      {phase === "landed" && shownPrize && shownResult ? (
        <div className="lk-slam flex flex-col items-center gap-1 text-center">
          <p className="text-2xl font-black" style={{ color: shownPrize.color === "#3f3f46" ? "#a1a1aa" : shownPrize.color }}>
            {shownPrize.kind === "nothing" ? "Nothing this time" : shownPrize.label}
          </p>
          <p className="text-sm text-zinc-300">
            {shownPrize.kind === "free_reroll"
              ? "Your next reroll today is free, on top of the usual three."
              : shownPrize.kind === "nothing"
                ? "Better luck tomorrow."
                : `${rollLabel(shownResult.attempt)}: ${formatNumber(shownResult.ep_before)} → ${formatNumber(shownResult.ep_after)} EP`}
          </p>
          <p className="text-xs text-zinc-500">Next spin tomorrow.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={phase !== "idle" || !target}
          className="lk-pulse w-full rounded-xl bg-gradient-to-r from-amber-400 to-pink-500 px-5 py-3 text-lg font-black text-zinc-950 transition enabled:hover:brightness-110 enabled:active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          {phase === "spinning" ? "Spinning…" : "SPIN"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      <details className="w-full text-xs text-zinc-500">
        <summary className="cursor-pointer select-none text-center">Prizes and odds</summary>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {prizes.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="flex-1 text-zinc-300">{p.label}</span>
              <span className="tabular-nums">{((100 * p.weight) / total).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
