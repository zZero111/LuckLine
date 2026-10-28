"use client";

import { useEffect, useState } from "react";
import { tierColor } from "@/lib/game/tiers";
import { HexBadge } from "./HexBadge";
import { formatNumber } from "./types";

export interface EventBoost {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  rarity: string;
  ep: number;
}

export interface EventToday {
  slug: string;
  name: string;
  tagline: string;
  roll_label: string;
  color: string;
  multiplier: number;
  ends_at: string;
  boosted: EventBoost[];
  hits: number;
  need: number;
  hit_today: boolean;
  reward: { id: string; name: string; kind: string } | null;
  reward_owned: boolean;
}

export interface EventNext {
  slug: string;
  name: string;
  tagline: string;
  color: string;
  day: string;
  days_away: number;
}

export interface EventStatus {
  today: EventToday | null;
  next: EventNext | null;
}

const NOUN: Record<string, string> = { aura: "aura", frame: "frame", name: "name style", reveal: "reveal" };
const pad = (n: number) => String(n).padStart(2, "0");

/** Time left until `endsAt`, as hours, minutes, seconds. */
function useRemaining(endsAt: string | null) {
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
  if (now === null || !endsAt) return null;
  const s = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** "Nov 13" from a yyyy-mm-dd date. */
export function shortDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Tints the page while an event is on (CSS in globals.css reads data-event and --event-color). */
export function useEventTint(color: string | null) {
  useEffect(() => {
    if (!color) return;
    document.body.dataset.event = "on";
    document.body.style.setProperty("--event-color", color);
    return () => {
      delete document.body.dataset.event;
      document.body.style.removeProperty("--event-color");
    };
  }, [color]);
}

/** The "limited event" header: title, countdown, boosted badges and the free reward's progress. */
export function EventBanner({ event, next }: { event: EventToday; next: EventNext | null }) {
  const left = useRemaining(event.ends_at);
  const c = event.color;
  const box = (value: number, label: string) => (
    <div className="flex w-20 flex-col items-center rounded-xl border px-3 py-2" style={{ borderColor: `${c}55`, background: "#00000055" }}>
      <span className="text-3xl font-black tabular-nums" style={{ color: `color-mix(in srgb, ${c} 45%, white)` }}>
        {pad(value)}
      </span>
      <span className="text-[11px] font-semibold tracking-widest text-zinc-400">{label}</span>
    </div>
  );
  return (
    <section className="flex w-full max-w-md flex-col items-center gap-5" aria-label={`${event.name} event`}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full px-4 py-1 text-xs font-black uppercase tracking-[0.3em]" style={{ color: c, background: `${c}26` }}>
          Limited event
        </span>
        <h2 className="text-5xl font-black uppercase tracking-tight sm:text-6xl" style={{ color: `color-mix(in srgb, ${c} 40%, white)`, textShadow: `0 0 28px ${c}` }}>
          {event.name}
        </h2>
        <p className="text-sm" style={{ color: `color-mix(in srgb, ${c} 55%, white)` }}>
          {event.tagline}
        </p>
      </div>
      {left && (
        <div className="flex gap-3" role="timer" aria-label="Time left in the event">
          {box(left.h, "HRS")}
          {box(left.m, "MIN")}
          {box(left.s, "SEC")}
        </div>
      )}
      <div className="w-full rounded-2xl border p-4" style={{ borderColor: `${c}55`, background: "#00000040" }}>
        <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em]" style={{ color: c }}>
          Boosted badges today
        </h3>
        <ul className="flex flex-col gap-3">
          {event.boosted.map((b) => (
            <li key={b.slug} className="flex items-center gap-3">
              <HexBadge color={tierColor(b.rarity)} size={52} glow>
                {b.emoji}
              </HexBadge>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-bold text-zinc-50">{b.name}</p>
                <p className="text-sm text-zinc-400">{b.description}</p>
              </div>
              <span className="rounded-full px-3 py-1 text-sm font-black text-zinc-950" style={{ background: c }}>
                {event.multiplier}×
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          A boosted badge pays {event.multiplier}× its EP today ({formatNumber(event.boosted[0]?.ep ?? 0)} EP becomes{" "}
          {formatNumber(Math.round((event.boosted[0]?.ep ?? 0) * event.multiplier))} EP).
        </p>
      </div>
      {event.reward && (
        <div className="w-full rounded-2xl border p-4" style={{ borderColor: `${c}33`, background: "#00000030" }}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-extrabold text-zinc-50">Event reward</h3>
            <span className="text-sm font-semibold" style={{ color: c }}>
              {event.reward.name} {NOUN[event.reward.kind] ?? ""}, free
            </span>
          </div>
          <div className="mt-3 flex gap-2" aria-label={`${event.hits} of ${event.need} event days`}>
            {Array.from({ length: event.need }, (_, i) => (
              <span key={i} className="h-3 flex-1 rounded-full" style={{ background: i < event.hits || event.reward_owned ? c : "#27272a" }} />
            ))}
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            {event.reward_owned
              ? "You've earned this reward."
              : event.hit_today
                ? "You hit a boosted badge today. Nice!"
                : `Roll a boosted badge on ${event.need} event days to keep the ${event.reward.name.toLowerCase()} ${NOUN[event.reward.kind] ?? ""}.`}
            {next && ` Next event: ${shortDate(next.day)}.`}
          </p>
        </div>
      )}
    </section>
  );
}

/** A small teaser for the next event, on ordinary days. */
export function NextEventTeaser({ next }: { next: EventNext }) {
  return (
    <p className="rounded-full border px-4 py-1.5 text-xs text-zinc-400" style={{ borderColor: `${next.color}44` }}>
      <span style={{ color: next.color }} className="font-bold">
        {next.name}
      </span>{" "}
      in {next.days_away} {next.days_away === 1 ? "day" : "days"} ({shortDate(next.day)}). {next.tagline.split("·")[1]?.trim()}
    </p>
  );
}
