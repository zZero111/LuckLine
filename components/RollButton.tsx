"use client";

import { useState } from "react";
import Link from "next/link";
import { sfx } from "@/lib/game/sfx";
import { createClient } from "@/lib/supabase/client";
import { Reveal } from "./Reveal";
import { SoundToggle } from "./SoundToggle";
import type { RollResultData } from "./types";

/** Minimum spin before the digits start locking, for suspense. */
const SPIN_MS = 900;

function friendlyError(message: string): { text: string; href?: string; label?: string; refresh?: boolean } {
  if (message.includes("already rolled today")) {
    return { text: "You've already rolled today.", refresh: true };
  }
  if (message.includes("choose a display name first")) {
    return { text: "Pick a display name before your first roll.", href: "/welcome", label: "Choose a name" };
  }
  if (message.includes("not signed in")) {
    return { text: "Your session has expired. Please sign in again.", href: "/login", label: "Sign in" };
  }
  return { text: "Something went wrong while rolling. Please try again." };
}

interface Props {
  onAlreadyRolled?: () => void;
  /** Badge slugs the player had earned before today. */
  earnedBefore?: ReadonlySet<string>;
  /** Consecutive days rolled up to yesterday. */
  streakBefore?: number;
}

export function RollButton({ onAlreadyRolled, earnedBefore, streakBefore = 0 }: Props) {
  const [phase, setPhase] = useState<"idle" | "rolling">("idle");
  const [result, setResult] = useState<RollResultData | null>(null);
  const [replay, setReplay] = useState(0);
  const [error, setError] = useState<ReturnType<typeof friendlyError> | null>(null);

  async function roll() {
    sfx.unlock();
    setError(null);
    setPhase("rolling");
    const started = Date.now();

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("roll_today");

    if (rpcError || !data) {
      setError(friendlyError(rpcError?.message ?? ""));
      setPhase("idle");
      return;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, SPIN_MS - (Date.now() - started))));
    setResult(data as unknown as RollResultData);
  }

  if (phase === "rolling") {
    const newSlugs = result && earnedBefore
      ? new Set(result.badges.map((b) => b.slug).filter((slug) => !earnedBefore.has(slug)))
      : undefined;
    return (
      <Reveal
        key={replay}
        result={result}
        animate
        newSlugs={newSlugs}
        streak={result ? streakBefore + 1 : undefined}
        onReplay={() => {
          sfx.unlock();
          window.scrollTo({ top: 0, behavior: "smooth" });
          setReplay((r) => r + 1);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        type="button"
        onClick={roll}
        className="lk-pulse rounded-2xl bg-violet-600 px-16 py-7 text-4xl font-black tracking-wide text-white transition hover:scale-105 hover:bg-violet-500 active:scale-95"
      >
        ROLL
      </button>
      <p className="text-sm text-zinc-500">
        {streakBefore > 0 ? `🔥 ${streakBefore}-day streak. Keep it going.` : "One shot. Make it count."}
      </p>
      <SoundToggle />
      {error && (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          <p>{error.text}</p>
          {error.href && (
            <Link href={error.href} className="font-medium text-violet-300 underline">
              {error.label}
            </Link>
          )}
          {error.refresh && (
            <button type="button" onClick={() => onAlreadyRolled?.()} className="font-medium text-violet-300 underline">
              Show my result
            </button>
          )}
        </div>
      )}
    </div>
  );
}
