"use client";

import { useEffect, useState } from "react";
import { badgeOneIn, formatOdds } from "@/lib/game/odds";
import { tierColor, tierRank } from "@/lib/game/tiers";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Chip } from "./Chip";

type CatalogBadge = { slug: string; name: string; emoji: string; description: string; rarity: string; ep: number };
type Loaded = { badges: CatalogBadge[]; counts: Map<string, number> | null; failed: boolean };

/** Every badge, rarest first. Earned ones light up with how many times you got them. */
export function BadgesView() {
  const { status, user } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    const supabase = createClient();
    const catalog = supabase.from("badges").select("slug, name, emoji, description, rarity, ep");
    const mine = userId
      ? supabase.from("rolls").select("roll_badges(badges(slug))").eq("user_id", userId).limit(1000)
      : Promise.resolve(null);
    Promise.all([catalog, mine]).then(([cat, own]) => {
      if (cancelled) return;
      let counts: Map<string, number> | null = null;
      if (own && !own.error) {
        counts = new Map();
        for (const roll of own.data ?? []) {
          for (const rb of roll.roll_badges) {
            const slug = rb.badges?.slug;
            if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
          }
        }
      }
      const badges = [...((cat.data ?? []) as CatalogBadge[])].sort(
        (a, b) => tierRank(b.rarity) - tierRank(a.rarity) || b.ep - a.ep,
      );
      setData({ badges, counts, failed: !!cat.error });
    });
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  if (!data) return <div className="h-64 animate-pulse rounded-xl bg-zinc-900" />;
  if (data.failed) return <p className="text-rose-300">Could not load the badges.</p>;

  const { badges, counts } = data;
  const collected = counts ? badges.filter((b) => counts.has(b.slug)).length : 0;

  return (
    <>
      {counts ? (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-300">
            Collected <span className="font-bold text-zinc-50">{collected}</span> of {badges.length}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
              style={{ width: `${badges.length ? (100 * collected) / badges.length : 0}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-zinc-400">Sign in and roll to start your collection.</p>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((b) => {
          const times = counts?.get(b.slug) ?? 0;
          const owned = times > 0;
          const odds = badgeOneIn(b.slug);
          const color = tierColor(b.rarity);
          return (
            <li
              key={b.slug}
              className={`flex gap-3 rounded-xl border bg-zinc-900/60 p-4 transition ${owned ? "" : "opacity-45 grayscale"}`}
              style={{ borderColor: owned ? `${color}88` : "rgb(39 39 42)", boxShadow: owned && tierRank(b.rarity) >= 4 ? `0 0 22px -8px ${color}` : undefined }}
            >
              <span className="text-4xl" aria-hidden>
                {b.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-zinc-100">{b.name}</p>
                  {owned && <span className="text-sm font-bold tabular-nums text-zinc-300">×{times}</span>}
                </div>
                <p className="text-xs text-zinc-400">{b.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip value={b.rarity} />
                  <span className="text-xs tabular-nums text-violet-300">{b.ep} EP</span>
                  {odds && <span className="text-xs text-zinc-500">{formatOdds(odds)}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
