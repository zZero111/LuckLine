"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { RollResult } from "./RollResult";
import type { RollResultData } from "./types";

const SPIN_MS = 1500;

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

function randomDigits() {
  return String(Math.floor(Math.random() * 1_000_001)).padStart(7, "0");
}

export function RollButton({ onAlreadyRolled }: { onAlreadyRolled?: () => void }) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [display, setDisplay] = useState("0000000");
  const [result, setResult] = useState<RollResultData | null>(null);
  const [error, setError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function roll() {
    setError(null);
    setPhase("spinning");
    timer.current = setInterval(() => setDisplay(randomDigits()), 60);
    const started = Date.now();

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("roll_today");

    const wait = Math.max(0, SPIN_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, rpcError ? 0 : wait));
    if (timer.current) clearInterval(timer.current);
    timer.current = null;

    if (rpcError || !data) {
      setError(friendlyError(rpcError?.message ?? ""));
      setPhase("idle");
      return;
    }
    setResult(data as unknown as RollResultData);
    setPhase("done");
  }

  if (phase === "done" && result) {
    return (
      <div className="animate-[fadein_0.5s_ease-out] w-full">
        <RollResult result={result} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {phase === "spinning" ? (
        <p className="font-mono text-6xl font-bold tabular-nums text-violet-300 blur-[1px] sm:text-7xl" aria-live="polite">
          {display}
        </p>
      ) : (
        <button
          type="button"
          onClick={roll}
          className="rounded-2xl bg-violet-600 px-14 py-6 text-3xl font-bold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500 active:scale-95"
        >
          Roll
        </button>
      )}
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
