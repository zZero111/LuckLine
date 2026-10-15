"use client";

import { useState } from "react";
import { Chip } from "./Chip";
import { formatNumber, rollLabel, type RollResultData } from "./types";

interface Props {
  balance: number;
  price: number;
  rerollsLeft: number;
  maxPerDay: number;
  /** All of today's rolls, in order. */
  rolls: RollResultData[];
  /** The roll currently on screen. */
  shown: RollResultData;
  onReroll: () => void;
  onShow: (attempt: number) => void;
}

/** Wallet, reroll button (with a confirm step) and today's rolls. */
export function RerollPanel({ balance, price, rerollsLeft, maxPerDay, rolls, shown, onReroll, onShow }: Props) {
  const [confirming, setConfirming] = useState(false);
  const best = rolls.reduce((a, b) => (b.ep > a.ep ? b : a), rolls[0]);
  const canAfford = balance >= price;
  const canReroll = canAfford && rerollsLeft > 0;

  return (
    <div className="lk-fade flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-zinc-400">Your EP</p>
        <p className="text-2xl font-extrabold tabular-nums text-amber-300">💰 {formatNumber(balance)}</p>
      </div>

      {shown !== best && (
        <p className="rounded-lg bg-zinc-800/70 px-3 py-2 text-sm text-zinc-300">
          Today counts your best roll: <span className="font-mono font-semibold">{formatNumber(best.number)}</span> ·{" "}
          {formatNumber(best.ep)} EP
        </p>
      )}

      {rerollsLeft <= 0 ? (
        <p className="text-center text-sm text-zinc-500">No rerolls left today. Come back tomorrow!</p>
      ) : confirming ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-zinc-300">
            Spend <span className="font-bold text-amber-300">{formatNumber(price)} EP</span> on another roll?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onReroll();
              }}
              className="rounded-lg bg-amber-400 px-5 py-2 font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-95"
            >
              Yes, reroll
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={!canReroll}
            onClick={() => setConfirming(true)}
            className="w-full rounded-xl bg-amber-400 px-5 py-3 text-lg font-black text-zinc-950 transition enabled:hover:bg-amber-300 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            🎲 Reroll · {formatNumber(price)} EP
          </button>
          <p className="text-xs text-zinc-500">
            {canAfford
              ? `${rerollsLeft} of ${maxPerDay} rerolls left today. Your best roll of the day counts.`
              : `You need ${formatNumber(price - balance)} more EP to reroll.`}
          </p>
        </div>
      )}

      {rolls.length > 1 && (
        <ul className="flex flex-col gap-1 border-t border-zinc-800 pt-3 text-sm">
          {rolls.map((r) => (
            <li key={r.attempt ?? 0}>
              <button
                type="button"
                onClick={() => onShow(r.attempt ?? 0)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-800 ${
                  r === shown ? "bg-zinc-800/80" : ""
                }`}
              >
                <span className="w-20 text-zinc-400">{rollLabel(r.attempt)}</span>
                <span className="flex-1 font-mono tabular-nums">{formatNumber(r.number)}</span>
                <span className="tabular-nums text-violet-300">{formatNumber(r.ep)} EP</span>
                <Chip value={r.tier} />
                <span className="w-4" aria-label={r === best ? "best" : undefined}>
                  {r === best ? "⭐" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
