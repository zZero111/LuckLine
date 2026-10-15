"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import { RollButton } from "./RollButton";
import { RollResult } from "./RollResult";
import type { RollBadge, RollResultData } from "./types";

type TodayRoll = { userId: string; result: RollResultData | null };

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
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
    createClient()
      .from("rolls")
      .select("roll_date, number, ep, tier, roll_badges(badges(slug, name, emoji, description, rarity, ep))")
      .eq("user_id", userId)
      .eq("roll_date", todayUtc())
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        let result: RollResultData | null = null;
        if (data) {
          const badges: RollBadge[] = data.roll_badges
            .map((rb) => rb.badges)
            .filter((b): b is RollBadge => b !== null)
            .sort((a, b) => b.ep - a.ep);
          result = { roll_date: data.roll_date, number: data.number, ep: data.ep, tier: data.tier, badges };
        }
        setToday({ userId, result });
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
  if (today.result) return <RollResult result={today.result} />;
  return <RollButton onAlreadyRolled={() => setReload((n) => n + 1)} />;
}
