"use client";

import { formatNumber } from "./types";

export interface CommunityStatus {
  revealed: boolean;
  players: number;
  number?: string;
  your_number?: number;
  matches?: number;
  distance?: number;
  positions?: boolean[];
  bonus?: number;
  rank?: number;
  distribution?: number[];
  ladder?: { matches: number; ep: number }[];
}

const LABEL = (m: number) => (m === 6 ? "Exact number" : `${m} digits match`);

/** Today's shared number and how close your roll came. Shown after you've rolled. */
export function CommunityCard({ data }: { data: CommunityStatus }) {
  if (!data.revealed) {
    return (
      <section className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4 text-center" aria-label="Community number">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Today&apos;s community number</h3>
        <p className="mt-2 text-sm text-zinc-400">One number for everyone. Roll to reveal it and see how many digits you match.</p>
      </section>
    );
  }
  const cn = data.number ?? "000000";
  const mine = String((data.your_number ?? 0) % 1000000).padStart(6, "0");
  const matches = data.matches ?? 0;
  const dist = data.distribution ?? [];
  const max = Math.max(1, ...dist);
  const total = dist.reduce((a, b) => a + b, 0);
  const fourPlus = total ? Math.round((100 * (dist[4] + dist[5] + dist[6])) / total) : 0;
  const digitBox = (d: string, i: number, kind: "community" | "mine") => {
    const hit = data.positions?.[i];
    const cls =
      kind === "community"
        ? "border-cyan-400 bg-zinc-950 text-cyan-200"
        : hit
          ? "border-emerald-400 bg-emerald-950 text-emerald-200"
          : "border-zinc-700 bg-zinc-950 text-zinc-500";
    return (
      <span key={i} className={`grid h-14 w-10 place-items-center rounded-xl border-2 font-mono text-3xl font-black sm:h-16 sm:w-12 ${cls}`}>
        {d}
      </span>
    );
  };
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <section className="rounded-2xl border border-cyan-400/50 bg-gradient-to-b from-cyan-950/40 to-zinc-900/60 p-4 text-center" style={{ boxShadow: "0 0 30px rgb(34 211 238 / 0.12)" }} aria-label="Community number">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Today&apos;s community number</h3>
        <div className="mt-3 flex justify-center gap-2" aria-label={`Community number ${cn}`}>
          {cn.split("").map((d, i) => digitBox(d, i, "community"))}
        </div>
        <p className="mt-3 text-sm text-zinc-400">Same for every player. {formatNumber(data.players)} {data.players === 1 ? "has" : "have"} rolled so far.</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="Your roll against the community number">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Your best match</h3>
          <p className="text-sm text-zinc-300">
            {matches} {matches === 1 ? "digit matches" : "digits match"}, <b className="text-zinc-100">{formatNumber(data.distance ?? 0)}</b> away
          </p>
        </div>
        <div className="mt-3 flex justify-center gap-2" aria-label={`Your roll ${mine}`}>
          {mine.split("").map((d, i) => digitBox(d, i, "mine"))}
        </div>
        <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${(data.bonus ?? 0) > 0 ? "bg-emerald-950/70 text-emerald-200" : "bg-zinc-800/60 text-zinc-300"}`}>
          <span>
            Closest {formatNumber(data.rank ?? 1)} of {formatNumber(data.players)} players
          </span>
          <span className="font-black tabular-nums">{(data.bonus ?? 0) > 0 ? `+${formatNumber(data.bonus ?? 0)} EP` : "No bonus yet"}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="Bonus ladder">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Bonus ladder</h3>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {(data.ladder ?? []).map((row) => {
            const current = matches === row.matches;
            const passed = matches > row.matches;
            return (
              <li key={row.matches} className={`flex justify-between ${current ? "font-bold text-emerald-300" : passed ? "text-zinc-500" : "text-zinc-200"}`}>
                <span>
                  {LABEL(row.matches)}
                  {current && " (you)"}
                </span>
                <span className="tabular-nums">+{formatNumber(row.ep)} EP</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="How everyone did">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">How everyone did</h3>
        <div className="mt-4 flex h-28 items-end gap-2">
          {dist.map((n, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${n} ${n === 1 ? "player" : "players"}`}>
              <span className="w-full rounded-t-md" style={{ height: `${Math.max(3, (n / max) * 100)}%`, background: i === matches ? "#34d399" : "#3f3f46" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 text-center text-sm">
          {dist.map((_, i) => (
            <span key={i} className={`flex-1 ${i === matches ? "font-bold text-emerald-300" : "text-zinc-500"}`}>
              {i}
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-zinc-400">
          Digits matching the community number. {fourPlus}% of players matched 4 or more.
        </p>
      </section>
    </div>
  );
}
