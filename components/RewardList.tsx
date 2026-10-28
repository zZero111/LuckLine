"use client";

import { useEffect } from "react";
import { sfx } from "@/lib/game/sfx";
import type { RollReward } from "./types";

const ICON: Record<RollReward["kind"], string> = {
  milestone: "🔥",
  album: "📖",
  community: "🌍",
  hunt: "🎯",
  event: "🎉",
};

/** Rewards a roll unlocked, shown once after the badges. */
export function RewardList({ rewards }: { rewards: RollReward[] }) {
  useEffect(() => {
    sfx.reward();
  }, []);
  return (
    <section className="lk-fade flex w-full max-w-md flex-col gap-2" aria-label="Rewards unlocked">
      <h3 className="text-center text-xs font-bold uppercase tracking-[0.3em] text-amber-300">Rewards unlocked</h3>
      <ul className="flex flex-col gap-2">
        {rewards.map((r, i) => (
          <li
            key={`${r.kind}-${r.title}`}
            className="lk-pop flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <span className="text-2xl" aria-hidden>
              {ICON[r.kind]}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-semibold text-amber-100">{r.title}</p>
              <p className="text-sm text-amber-300">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
