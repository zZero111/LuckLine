"use client";

import { useState } from "react";
import { capitalize } from "./Chip";
import { formatNumber, type RollResultData } from "./types";

export function shareText(result: RollResultData, origin: string) {
  const emojis = result.badges.map((b) => b.emoji).join("");
  return `Luckline ${result.roll_date} 🎲 ${formatNumber(result.number)} · ${capitalize(result.tier)} · ${formatNumber(result.ep)} EP${emojis ? ` ${emojis}` : ""}\n${origin}`;
}

export function ShareButton({ result }: { result: RollResultData }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText(result, window.location.origin));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-violet-500/50 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
    >
      {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : "Copy share text"}
    </button>
  );
}
