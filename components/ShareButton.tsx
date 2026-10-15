"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { percentileLine } from "@/lib/game/odds";
import { tierSquare } from "@/lib/game/tiers";
import { capitalize } from "./Chip";
import { formatNumber, type RollResultData } from "./types";

/**
 * Example:
 *   Luckline 2026-10-15 🎲 108,923
 *   Rare · 37 EP 🟦
 *   🟩🟦🟪
 *   Top 4.21% of all possible rolls · 🔥3
 *   https://example.github.io/RNGdle-2/
 */
export function shareText(result: RollResultData, url: string, streak?: number) {
  const squares = [...result.badges]
    .sort((a, b) => a.ep - b.ep)
    .map((b) => tierSquare(b.rarity))
    .join("");
  const lines = [
    `Luckline ${result.roll_date} 🎲 ${formatNumber(result.number)}`,
    `${capitalize(result.tier)} · ${formatNumber(result.ep)} EP ${tierSquare(result.tier)}`,
    squares || "no badges today",
    `${percentileLine(result.ep)}${streak && streak > 1 ? ` · 🔥${streak}` : ""}`,
    url,
  ];
  return lines.join("\n");
}

export function ShareButton({ result, streak }: { result: RollResultData; streak?: number }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText(result, `${window.location.origin}${BASE_PATH}/`, streak));
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
      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
    >
      {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : "Share result"}
    </button>
  );
}
