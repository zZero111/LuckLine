"use client";

import { useState } from "react";
import { fusionReward, type AlbumBadge, type AlbumSection } from "@/lib/badges/albumGroups";
import { sfx } from "@/lib/game/sfx";
import { tierColor, tierRank } from "@/lib/game/tiers";
import { createClient } from "@/lib/supabase/client";
import { capitalize } from "./Chip";
import { Confetti } from "./Confetti";
import { HexBadge } from "./HexBadge";
import { formatNumber } from "./types";

interface Props {
  /** Sections that are real families with enough badges to fuse. */
  families: AlbumSection[];
  owned: ReadonlySet<string>;
  fused: ReadonlySet<string>;
  onFused: () => void;
}

const MAX_SHOWN = 9;

/** A finished family can be fused into a Master badge: a one-time EP reward and the prism name style. */
export function FusionPanel({ families, owned, fused, onFused }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; reward: number } | null>(null);
  const [burst, setBurst] = useState(0);

  const have = (sec: AlbumSection) => sec.badges.filter((b) => owned.has(b.slug)).length;
  const ready = families.filter((f) => !fused.has(f.family!) && have(f) === f.badges.length);
  const sec = ready.find((f) => f.family === picked) ?? ready[0];

  if (done) {
    return (
      <section className="lk-pop flex flex-col items-center gap-2 rounded-3xl border border-amber-400/60 bg-gradient-to-b from-amber-950/50 to-zinc-900/70 p-6 text-center" role="status">
        {burst > 0 && <Confetti key={burst} color="#facc15" rank={6} />}
        <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">Fused!</p>
        <HexBadge color="#facc15" size={96} glow>
          👑
        </HexBadge>
        <h2 className="text-2xl font-black">Master of {done.title}</h2>
        <p className="text-amber-200">+{formatNumber(done.reward)} EP and a permanent prism name style</p>
        <button type="button" onClick={() => setDone(null)} className="mt-2 rounded-xl border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800">
          Keep collecting
        </button>
      </section>
    );
  }

  if (!sec) {
    // Nothing to fuse yet: point at the closest family.
    const closest = families
      .filter((f) => !fused.has(f.family!))
      .map((f) => ({ f, left: f.badges.length - have(f) }))
      .filter((x) => x.left > 0 && have(x.f) > 0)
      .sort((a, b) => a.left - b.left || b.f.badges.length - a.f.badges.length)[0];
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
        <b className="text-zinc-200">Fusion:</b> collect every badge in a family (3 or more) to fuse it into a Master badge for a big EP reward and a prism name.
        {closest && (
          <>
            {" "}
            Closest: <b className="text-zinc-200">{closest.f.title}</b>, {have(closest.f)} of {closest.f.badges.length}.
          </>
        )}
      </p>
    );
  }

  const rarest = [...sec.badges].sort((a, b) => tierRank(b.rarity) - tierRank(a.rarity) || b.ep - a.ep)[0] as AlbumBadge;
  const reward = fusionReward(sec.badges.length);
  const nextClosest = families
    .filter((f) => f !== sec && !fused.has(f.family!) && have(f) < f.badges.length && have(f) > 0)
    .sort((a, b) => a.badges.length - have(a) - (b.badges.length - have(b)))[0];

  async function fuse() {
    if (!sec?.family) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("fuse_family", { fam: sec.family });
    setBusy(false);
    if (err) {
      setError(err.message.includes("already fused") ? "That family is already fused." : "Couldn't fuse that family. Please try again.");
      return;
    }
    sfx.fuse();
    setBurst((b) => b + 1);
    setDone({ title: sec.title, reward });
    onFused();
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Family fusion">
      {ready.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Families ready to fuse">
          {ready.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setPicked(f.family)}
              aria-pressed={f.family === sec.family}
              className={`rounded-full px-3 py-1 text-xs font-bold ${f.family === sec.family ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}
            >
              {f.title}
            </button>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-violet-300">Family complete</p>
        <h2 className="text-3xl font-black tracking-tight">{sec.title}</h2>
        <p className="text-zinc-400">You&apos;ve collected all {sec.badges.length} badges. Fuse them into one Master badge.</p>
      </div>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-2">
          {sec.badges.slice(0, MAX_SHOWN).map((b) => (
            <li key={b.slug} className="flex flex-col items-center gap-1">
              <HexBadge color={tierColor(b.rarity)} size={44}>
                {b.emoji}
              </HexBadge>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Owned</span>
            </li>
          ))}
          {sec.badges.length > MAX_SHOWN && <li className="self-center text-sm text-zinc-400">+{sec.badges.length - MAX_SHOWN} more</li>}
        </ul>
        <p className="my-3 text-center text-3xl text-violet-300" aria-hidden>
          ↓
        </p>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full p-1" style={{ background: "conic-gradient(#f43f5e, #f59e0b, #84cc16, #22d3ee, #8b5cf6, #f43f5e)" }}>
            <HexBadge color="#a78bfa" size={104} glow className="rounded-full bg-zinc-950">
              <span className="flex flex-col items-center">
                <span className="text-[11px] font-black tracking-[0.2em] text-violet-200">MASTER</span>
                <span className="text-3xl">{rarest.emoji}</span>
              </span>
            </HexBadge>
          </div>
          <h3 className="text-2xl font-black">Master of {sec.title}</h3>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black uppercase tracking-wider" style={{ color: tierColor(rarest.rarity) }}>
            {capitalize(rarest.rarity)} · Prism name
          </span>
        </div>
      </div>
      <dl className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
        <dt className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">You get</dt>
        <dd className="mt-2 flex justify-between">
          <span>One-time reward</span>
          <b className="text-amber-300">+{formatNumber(reward)} EP</b>
        </dd>
        <dd className="mt-1.5 flex justify-between">
          <span>Permanent prism name style</span>
          <b>Yes</b>
        </dd>
        <dd className="mt-1.5 flex justify-between">
          <span>Your {sec.badges.length} badges stay in your Album</span>
          <b>Kept</b>
        </dd>
      </dl>
      <button
        type="button"
        disabled={busy}
        onClick={fuse}
        className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-4 text-xl font-black uppercase tracking-widest text-zinc-950 shadow-lg shadow-amber-900/40 transition hover:brightness-110 active:scale-95 disabled:opacity-60"
      >
        {busy ? "Fusing…" : "Fuse the family"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      {nextClosest && (
        <p className="text-center text-sm text-zinc-500">
          {nextClosest.title}: {have(nextClosest)} of {nextClosest.badges.length} collected. {nextClosest.badges.length - have(nextClosest)}{" "}
          {nextClosest.badges.length - have(nextClosest) === 1 ? "badge" : "badges"} left to fuse.
        </p>
      )}
    </section>
  );
}
