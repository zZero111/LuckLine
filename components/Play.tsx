"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { revealPalette } from "@/lib/game/cosmetics";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import { CommunityCard, type CommunityStatus } from "./CommunityCard";
import { EventBanner, NextEventTeaser, useEventTint, type EventStatus } from "./EventBanner";
import { HuntCard, HuntChance, HuntStreak, type HuntStatus } from "./HuntPanel";
import { LuckyWheel, type SpinOutcome } from "./LuckyWheel";
import { RerollPanel } from "./RerollPanel";
import { Reveal } from "./Reveal";
import { RollButton, friendlyError } from "./RollButton";
import { RollResult } from "./RollResult";
import type { RollBadge, RollResultData, WheelPrize, WheelSpin } from "./types";

/** Fallback if reroll_terms() can't be fetched; the database enforces the real values. */
const DEFAULT_TERMS = { price: 400, max_per_day: 3 };
/** Minimum spin before the digits start locking, for suspense. */
const SPIN_MS = 1500;

interface DayState {
  userId: string;
  /** Today's rolls in attempt order (daily roll first). */
  rolls: RollResultData[];
  /** Badge slugs earned on days before today. */
  earnedBefore: Set<string>;
  /** Consecutive days rolled, ending yesterday. */
  streakBefore: number;
  balance: number;
  terms: { price: number; max_per_day: number };
  prizes: WheelPrize[];
  /** Today's Lucky Wheel spin, if used. */
  spin: WheelSpin | null;
}

function utcDay(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Days in a row ending at `from` (inclusive), walking back one UTC day at a time. */
function streakEndingAt(days: Set<string>, from: string) {
  let n = 0;
  const d = new Date(`${from}T00:00:00Z`);
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

/** Badges in `roll` the player had never earned before it. */
function newSlugsFor(day: DayState, roll: RollResultData) {
  const seen = new Set(day.earnedBefore);
  for (const r of day.rolls) {
    if ((r.attempt ?? 0) >= (roll.attempt ?? 0)) break;
    for (const b of r.badges) seen.add(b.slug);
  }
  return new Set(roll.badges.map((b) => b.slug).filter((slug) => !seen.has(slug)));
}

/** Everything the home page shows besides the day's rolls. */
interface Extras {
  event: EventStatus | null;
  hunt: HuntStatus | null;
  community: CommunityStatus | null;
  streak: { current: number; shield_will_cover: boolean; at_risk: boolean; shields: { count: number } } | null;
  /** Free rerolls from rewards. */
  tokens: number;
}

const skeleton = <div className="h-40 w-full max-w-md lk-shimmer rounded-xl bg-zinc-900" />;

/** The home page play area: sign-in prompt, roll button, reveal and rerolls. */
export function Play() {
  const { status, user, displayName, cosmetics, refreshProfile } = useAuth();
  const [day, setDay] = useState<DayState | null>(null);
  const [reload, setReload] = useState(0);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [extrasKey, setExtrasKey] = useState(0);
  // A roll in flight or just made this visit: animate its reveal.
  const [live, setLive] = useState<{ key: number; result: RollResultData | null } | null>(null);
  const [shownAttempt, setShownAttempt] = useState<number | null>(null);
  const [revealDone, setRevealDone] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const userId = user?.id;
  const hasProfile = typeof displayName === "string";
  useEventTint(extras?.event?.today?.color ?? null);

  useEffect(() => {
    if (!userId || !hasProfile) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.rpc("event_status"),
      supabase.rpc("hunt_today"),
      supabase.rpc("my_streak"),
      supabase.rpc("community_today"),
      supabase.from("reroll_tokens").select("count").eq("user_id", userId).maybeSingle(),
    ]).then(([ev, hunt, streak, community, tokens]) => {
      if (cancelled) return;
      const huntData = hunt.data as unknown as HuntStatus | null;
      setExtras({
        event: (ev.data as unknown as EventStatus | null) ?? null,
        hunt: huntData?.available ? huntData : null,
        community: (community.data as unknown as CommunityStatus | null) ?? null,
        streak: (streak.data as unknown as Extras["streak"]) ?? null,
        tokens: Number(tokens.data?.count ?? 0),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, hasProfile, extrasKey]);

  useEffect(() => {
    if (!userId || !hasProfile) return;
    let cancelled = false;
    const supabase = createClient();
    const today = utcDay();
    Promise.all([
      supabase
        .from("rolls")
        .select(
          "roll_date, attempt, number, ep, base_ep, multiplier, bonus_ep, event_bonus_ep, free_reroll, tier, roll_badges(badges(slug, name, emoji, description, rarity, ep))",
        )
        .eq("user_id", userId)
        .order("roll_date", { ascending: false })
        .order("attempt", { ascending: true })
        .limit(500),
      supabase.from("ep_wallets").select("balance").eq("user_id", userId).maybeSingle(),
      supabase.rpc("reroll_terms"),
      supabase.from("wheel_prizes").select("*").order("sort"),
      supabase
        .from("wheel_spins")
        .select("prize_id, ep_before, ep_after, free_reroll_used, rolls(attempt)")
        .eq("user_id", userId)
        .eq("spin_date", today)
        .maybeSingle(),
    ]).then(([rollsRes, walletRes, termsRes, prizesRes, spinRes]) => {
      if (cancelled) return;
      const rolls: RollResultData[] = [];
      const earnedBefore = new Set<string>();
      const days = new Set<string>();
      for (const row of rollsRes.data ?? []) {
        days.add(row.roll_date);
        const badges: RollBadge[] = row.roll_badges
          .map((rb) => rb.badges)
          .filter((b): b is RollBadge => b !== null)
          .sort((a, b) => b.ep - a.ep);
        if (row.roll_date === today) {
          rolls.push({
            roll_date: row.roll_date,
            attempt: row.attempt,
            number: row.number,
            ep: row.ep,
            base_ep: row.base_ep,
            multiplier: Number(row.multiplier),
            bonus_ep: row.bonus_ep,
            event_bonus: row.event_bonus_ep,
            free: row.free_reroll,
            tier: row.tier,
            badges,
          });
        } else {
          for (const b of badges) earnedBefore.add(b.slug);
        }
      }
      const terms = (termsRes.data as DayState["terms"] | null) ?? DEFAULT_TERMS;
      setDay({
        userId,
        rolls,
        earnedBefore,
        streakBefore: streakEndingAt(days, utcDay(-1)),
        balance: Number(walletRes.data?.balance ?? 0),
        terms,
        prizes: ((prizesRes.data ?? []) as WheelPrize[]).map((p) => ({ ...p, value: Number(p.value) })),
        spin: spinRes.data
          ? {
              prize_id: spinRes.data.prize_id,
              attempt: spinRes.data.rolls?.attempt ?? 0,
              ep_before: spinRes.data.ep_before,
              ep_after: spinRes.data.ep_after,
              free_reroll_used: spinRes.data.free_reroll_used,
            }
          : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, hasProfile, reload]);

  const markDone = useCallback(() => setRevealDone(true), []);

  async function spinWheel(): Promise<SpinOutcome> {
    const { data, error: rpcError } = await createClient().rpc("spin_wheel");
    if (rpcError || !data) throw new Error(friendlyError(rpcError?.message ?? "").text);
    const r = data as unknown as Omit<SpinOutcome, "prize"> & { prize: { id: number } };
    const prize = day?.prizes.find((p) => p.id === r.prize.id);
    if (!prize) throw new Error("Unknown prize. Please refresh.");
    return { ...r, prize };
  }

  function applySpin(o: SpinOutcome) {
    setDay((d) => {
      if (!d) return d;
      const rolls = d.rolls.map((r) => {
        if ((r.attempt ?? 0) !== o.attempt) return r;
        const k = o.prize;
        return {
          ...r,
          ep: o.ep_after,
          multiplier: k.kind === "multiplier" ? k.value : r.multiplier,
          bonus_ep: k.kind === "bonus" ? (r.bonus_ep ?? 0) + k.value : r.bonus_ep,
        };
      });
      return {
        ...d,
        rolls,
        balance: o.balance ?? d.balance,
        spin: { prize_id: o.prize.id, attempt: o.attempt, ep_before: o.ep_before, ep_after: o.ep_after, free_reroll_used: false },
      };
    });
    setLive(null);
    setShownAttempt(o.attempt);
  }

  async function roll(kind: "roll" | "reroll") {
    if (!day) return;
    sfx.unlock();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setError(null);
    setRevealDone(false);
    const key = Date.now();
    setLive({ key, result: null });
    const started = Date.now();
    const { data, error: rpcError } = await createClient().rpc(kind === "roll" ? "roll_today" : "reroll_today");
    if (rpcError || !data) {
      setLive(null);
      setRevealDone(true);
      setError(friendlyError(rpcError?.message ?? ""));
      return;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, SPIN_MS - (Date.now() - started))));
    const result = data as unknown as RollResultData;
    result.badges = [...result.badges].sort((a, b) => b.ep - a.ep);
    // A free reroll uses the wheel's first, then a reward token (the same order as the database).
    const wheelFree = (d: DayState) =>
      !!d.spin && d.prizes.find((p) => p.id === d.spin!.prize_id)?.kind === "free_reroll" && !d.spin.free_reroll_used;
    setDay(
      (d) =>
        d && {
          ...d,
          rolls: [...d.rolls.filter((r) => r.attempt !== result.attempt), result],
          balance: result.balance ?? d.balance,
          spin: result.free && d.spin && wheelFree(d) ? { ...d.spin, free_reroll_used: true } : d.spin,
        },
    );
    if (result.free) setExtras((x) => x && (day && wheelFree(day) ? x : { ...x, tokens: Math.max(0, x.tokens - 1) }));
    setExtrasKey((k) => k + 1);
    void refreshProfile();
    setShownAttempt(result.attempt ?? 0);
    setLive({ key, result });
  }

  if (status === "loading") return skeleton;

  if (status === "signedOut") {
    return (
      <div className="flex max-w-md flex-col items-center gap-5">
        <p className="text-lg text-zinc-300">
          Every day you get one roll. Rare patterns earn badges and EP, and EP buys rerolls. See how lucky you really are.
        </p>
        <Link href="/login" className="rounded-xl bg-violet-600 px-8 py-3 text-lg font-semibold text-white hover:bg-violet-500">
          Sign in to play
        </Link>
      </div>
    );
  }

  if (displayName === undefined) return skeleton;

  if (displayName === null) {
    return (
      <div className="flex max-w-md flex-col items-center gap-4">
        <p className="text-zinc-300">Pick a display name to start rolling.</p>
        <Link href="/welcome" className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
          Choose a display name
        </Link>
      </div>
    );
  }

  if (!day || day.userId !== userId) return skeleton;

  const streakBefore = extras?.streak?.current ?? day.streakBefore;
  const streak = (live?.result?.streak ?? undefined) || streakBefore + 1;
  const event = extras?.event?.today ?? null;
  const next = extras?.event?.next ?? null;
  const tokens = extras?.tokens ?? 0;
  const shieldNote = extras?.streak?.shield_will_cover
    ? "🛡 A streak shield will cover the day you missed."
    : extras?.streak?.at_risk
      ? "Your streak ended while you were away. Today starts a new one."
      : null;
  const errorBox = error && (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
      <p>{error.text}</p>
      {error.href && (
        <Link href={error.href} className="font-medium text-violet-300 underline">
          {error.label}
        </Link>
      )}
      {error.refresh && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReload((n) => n + 1);
          }}
          className="font-medium text-violet-300 underline"
        >
          Refresh
        </button>
      )}
    </div>
  );

  // No roll yet today (and none in flight): the big button.
  if (!day.rolls.length && !live) {
    const rerolls = day.terms.max_per_day + tokens;
    return (
      <div className="flex w-full flex-col items-center gap-6">
        {event ? <EventBanner event={event} next={next} /> : next && <NextEventTeaser next={next} />}
        {extras?.hunt && <HuntCard hunt={extras.hunt} />}
        <RollButton
          onRoll={() => roll("roll")}
          streakBefore={streakBefore}
          label={event?.roll_label ?? "ROLL"}
          color={event?.color}
          note={[shieldNote, `Your daily roll is ready. ${rerolls} ${rerolls === 1 ? "reroll" : "rerolls"} available.`].filter(Boolean).join(" ")}
        />
        {extras?.hunt && <HuntStreak hunt={extras.hunt} />}
        {extras?.hunt && <HuntChance hunt={extras.hunt} />}
        {errorBox}
      </div>
    );
  }

  const latest = day.rolls[day.rolls.length - 1];
  const shown = day.rolls.find((r) => (r.attempt ?? 0) === shownAttempt) ?? latest;
  const lastAttempt = latest ? (latest.attempt ?? 0) : 0;
  const spinPrize = day.spin ? day.prizes.find((p) => p.id === day.spin!.prize_id) : undefined;
  const wonFreeReroll = spinPrize?.kind === "free_reroll";
  const wheelFreeLeft = wonFreeReroll && !day.spin!.free_reroll_used ? 1 : 0;
  const freeCount = wheelFreeLeft + tokens;
  const freeAvailable = freeCount > 0;
  const paidUsed = day.rolls.filter((r) => (r.attempt ?? 0) > 0 && !r.free).length;
  const rerollsLeft = Math.max(0, day.terms.max_per_day - paidUsed) + freeCount;

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {live && (live.result === null || live.result === shown) ? (
        <Reveal
          key={live.key}
          result={live.result}
          animate
          newSlugs={live.result ? newSlugsFor(day, live.result) : undefined}
          streak={live.result ? streak : undefined}
          palette={revealPalette(cosmetics.reveal)}
          onDone={markDone}
          onReplay={() => {
            sfx.unlock();
            window.scrollTo({ top: 0, behavior: "smooth" });
            setRevealDone(false);
            setLive({ key: Date.now(), result: live.result });
          }}
        />
      ) : (
        shown && (
          <RollResult
            key={`static-${shown.attempt ?? 0}`}
            result={shown}
            newSlugs={newSlugsFor(day, shown)}
            streak={streak}
            onDone={markDone}
          />
        )
      )}
      {errorBox}
      {revealDone && latest && (
        <RerollPanel
          balance={day.balance}
          price={day.terms.price}
          rerollsLeft={rerollsLeft}
          maxPerDay={rerollsLeft + Math.max(0, day.rolls.length - 1)}
          freeAvailable={freeAvailable}
          rolls={day.rolls}
          shown={shown}
          onReroll={() => roll("reroll")}
          onShow={(attempt) => {
            setLive(null);
            setShownAttempt(attempt);
          }}
        />
      )}
      {revealDone && latest && extras?.community && <CommunityCard data={extras.community} />}
      {revealDone && latest && day.prizes.length > 0 && (
        <LuckyWheel
          prizes={day.prizes}
          spin={day.spin}
          target={day.spin ? null : { attempt: lastAttempt, number: latest.number, ep: latest.ep }}
          onSpin={spinWheel}
          onSettled={applySpin}
        />
      )}
      {revealDone && latest && extras?.hunt && <HuntCard hunt={extras.hunt} />}
      {revealDone && latest && extras?.hunt && <HuntStreak hunt={extras.hunt} />}
      {revealDone && latest && event && <EventBanner event={event} next={next} />}
    </div>
  );
}
