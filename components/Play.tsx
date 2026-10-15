"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import { RollButton } from "./RollButton";
import { RollResult } from "./RollResult";
import type { RollBadge, RollResultData } from "./types";

type TodayRoll = {
  userId: string;
  result: RollResultData | null;
  /** Badge slugs earned on days before today. */
  earnedBefore: Set<string>;
  /** Consecutive days rolled, ending yesterday. */
  streakBefore: number;
};

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

const skeleton = <div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-zinc-900" />;

/** The home page play area: sign-in prompt, roll button, or today's result. */
export function Play() {
  const { status, user, displayName } = useAuth();
  const [today, setToday] = useState<TodayRoll | null>(null);
  const [reload, setReload] = useState(0);
  const userId = user?.id;
  const hasProfile = typeof displayName === "string";

  useEffect(() => {
    if (!userId || !hasProfile) return;
    let cancelled = false;
    const today = utcDay();
    createClient()
      .from("rolls")
      .select("roll_date, number, ep, tier, roll_badges(badges(slug, name, emoji, description, rarity, ep))")
      .eq("user_id", userId)
      .order("roll_date", { ascending: false })
      .limit(400)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data ?? [];
        let result: RollResultData | null = null;
        const earnedBefore = new Set<string>();
        const days = new Set<string>();
        for (const row of rows) {
          days.add(row.roll_date);
          const badges: RollBadge[] = row.roll_badges
            .map((rb) => rb.badges)
            .filter((b): b is RollBadge => b !== null)
            .sort((a, b) => b.ep - a.ep);
          if (row.roll_date === today) {
            result = { roll_date: row.roll_date, number: row.number, ep: row.ep, tier: row.tier, badges };
          } else {
            for (const b of badges) earnedBefore.add(b.slug);
          }
        }
        setToday({ userId, result, earnedBefore, streakBefore: streakEndingAt(days, utcDay(-1)) });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, hasProfile, reload]);

  if (status === "loading") return skeleton;

  if (status === "signedOut") {
    return (
      <div className="flex max-w-md flex-col items-center gap-5">
        <p className="text-lg text-zinc-300">
          Every day you get exactly one roll. Rare patterns earn badges and EP. See how lucky you really are.
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

  if (!today || today.userId !== userId) return skeleton;
  if (today.result) {
    const newSlugs = new Set(today.result.badges.map((b) => b.slug).filter((slug) => !today.earnedBefore.has(slug)));
    return <RollResult result={today.result} newSlugs={newSlugs} streak={today.streakBefore + 1} />;
  }
  return (
    <RollButton
      onAlreadyRolled={() => setReload((n) => n + 1)}
      earnedBefore={today.earnedBefore}
      streakBefore={today.streakBefore}
    />
  );
}
