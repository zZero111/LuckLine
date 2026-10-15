import Link from "next/link";
import { Suspense } from "react";
import { Countdown } from "@/components/Countdown";
import { RollButton } from "@/components/RollButton";
import { RollResult } from "@/components/RollResult";
import type { RollBadge, RollResultData } from "@/components/types";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="text-violet-400">Luck</span>line
        </h1>
        <p className="mt-3 text-zinc-400">One roll a day. 0 to 1,000,000. Collect badges.</p>
      </div>
      <Suspense fallback={<div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-zinc-900" />}>
        <Play />
      </Suspense>
      <Countdown />
    </div>
  );
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function Play() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    return (
      <div className="flex max-w-md flex-col items-center gap-4">
        <p className="text-zinc-300">Pick a display name to start rolling.</p>
        <Link href="/welcome" className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
          Choose a display name
        </Link>
      </div>
    );
  }

  const { data: roll } = await supabase
    .from("rolls")
    .select("roll_date, number, ep, tier, roll_badges(badges(slug, name, emoji, description, rarity, ep))")
    .eq("user_id", user.id)
    .eq("roll_date", todayUtc())
    .maybeSingle();

  if (!roll) return <RollButton />;

  const badges: RollBadge[] = roll.roll_badges
    .map((rb) => rb.badges)
    .filter((b): b is RollBadge => b !== null)
    .sort((a, b) => b.ep - a.ep);
  const result: RollResultData = { roll_date: roll.roll_date, number: roll.number, ep: roll.ep, tier: roll.tier, badges };
  return <RollResult result={result} />;
}
