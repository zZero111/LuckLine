import { Chip } from "./Chip";
import { ShareButton } from "./ShareButton";
import { formatNumber, type RollResultData } from "./types";

/** Today's result: number, tier, EP, badge list and share button. */
export function RollResult({ result }: { result: RollResultData }) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-zinc-500">Your roll for {result.roll_date}</p>
        <p className="mt-2 font-mono text-6xl font-bold tabular-nums text-zinc-50 sm:text-7xl">
          {formatNumber(result.number)}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Chip value={result.tier} size="lg" />
          <span className="text-lg font-semibold text-violet-300">{formatNumber(result.ep)} EP</span>
        </div>
      </div>

      {result.badges.length > 0 ? (
        <ul className="w-full max-w-md divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/60">
          {result.badges.map((b) => (
            <li key={b.slug} className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {b.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-100">{b.name}</p>
                <p className="truncate text-xs text-zinc-500">{b.description}</p>
              </div>
              <Chip value={b.rarity} />
              <span className="w-16 text-right text-sm tabular-nums text-violet-300">+{b.ep} EP</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No badges this time. Better luck tomorrow.</p>
      )}

      <ShareButton result={result} />
    </div>
  );
}
