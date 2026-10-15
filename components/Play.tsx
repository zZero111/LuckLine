"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import { RerollPanel } from "./RerollPanel";
import { Reveal } from "./Reveal";
import { RollButton, friendlyError } from "./RollButton";
import { RollResult } from "./RollResult";
import type { RollBadge, RollResultData } from "./types";

/** Fallback if reroll_terms() can't be fetched; the database enforces the real values. */
const DEFAULT_TERMS = { price: 100, max_per_day: 3 };
/** Minimum spin before the digits start locking, for suspense. */
const SPIN_MS = 900;

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

const skeleton = <div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-zinc-900" />;

/** The home page play area: sign-in prompt, roll button, reveal and rerolls. */
export function Play() {
  const { status, user, displayName } = useAuth();
  const [day, setDay] = useState<DayState | null>(null);
  const [reload, setReload] = useState(0);
  // A roll in flight or just made this visit: animate its reveal.
  const [live, setLive] = useState<{ key: number; result: RollResultData | null } | null>(null);
  const [shownAttempt, setShownAttempt] = useState<number | null>(null);
  const [revealDone, setRevealDone] = useState(false);
  const [error, setError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const userId = user?.id;
  const hasProfile = typeof displayName === "string";

  useEffect(() => {
    if (!userId || !hasProfile) return;
    let cancelled = false;
    const supabase = createClient();
    const today = utcDay();
    Promise.all([
      supabase
        .from("rolls")
        .select("roll_date, attempt, number, ep, tier, roll_badges(badges(slug, name, emoji, description, rarity, ep))")
        .eq("user_id", userId)
        .order("roll_date", { ascending: false })
        .order("attempt", { ascending: true })
        .limit(500),
      supabase.from("ep_wallets").select("balance").eq("user_id", userId).maybeSingle(),
      supabase.rpc("reroll_terms"),
    ]).then(([rollsRes, walletRes, termsRes]) => {
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
          rolls.push({ roll_date: row.roll_date, attempt: row.attempt, number: row.number, ep: row.ep, tier: row.tier, badges });
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
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, hasProfile, reload]);

  const markDone = useCallback(() => setRevealDone(true), []);

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
    setDay((d) =>
      d && {
        ...d,
        rolls: [...d.rolls.filter((r) => r.attempt !== result.attempt), result],
        balance: result.balance ?? d.balance,
      },
    );
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

  const streak = day.streakBefore + 1;
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
    return (
      <div className="flex flex-col items-center gap-6">
        <RollButton onRoll={() => roll("roll")} streakBefore={day.streakBefore} />
        {errorBox}
      </div>
    );
  }

  const latest = day.rolls[day.rolls.length - 1];
  const shown = day.rolls.find((r) => (r.attempt ?? 0) === shownAttempt) ?? latest;
  const lastAttempt = latest ? (latest.attempt ?? 0) : 0;
  const rerollsLeft = day.terms.max_per_day - lastAttempt;

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {live && (live.result === null || live.result === shown) ? (
        <Reveal
          key={live.key}
          result={live.result}
          animate
          newSlugs={live.result ? newSlugsFor(day, live.result) : undefined}
          streak={live.result ? streak : undefined}
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
          maxPerDay={day.terms.max_per_day}
          rolls={day.rolls}
          shown={shown}
          onReroll={() => roll("reroll")}
          onShow={(attempt) => {
            setLive(null);
            setShownAttempt(attempt);
          }}
        />
      )}
    </div>
  );
}
