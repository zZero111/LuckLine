"use client";

import { useEffect, useState } from "react";
import { badgeOneIn, formatOdds } from "@/lib/game/odds";
import { tierColor, tierRank } from "@/lib/game/tiers";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { BadgeAura } from "./BadgeAura";
import { Chip } from "./Chip";
import { formatNumber } from "./types";

type CatalogBadge = { slug: string; name: string; emoji: string; family: string; description: string; rarity: string; ep: number };
type Loaded = { badges: CatalogBadge[]; counts: Map<string, number> | null; failed: boolean };

/** Every badge, rarest first. Earned ones light up with how many times you got them. */
export function BadgesView() {
  const { status, user } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<string>("all");
  const [show, setShow] = useState<"all" | "have" | "missing">("all");
  const userId = user?.id;

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    const supabase = createClient();
    const catalog = supabase.from("badges").select("slug, name, emoji, family, description, rarity, ep");
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

  if (!data) return <div className="h-64 lk-shimmer rounded-xl bg-zinc-900" />;
  if (data.failed) return <p className="text-rose-300">Could not load the badges.</p>;

  const { badges, counts } = data;
  const collected = counts ? badges.filter((b) => counts.has(b.slug)).length : 0;
  const familySize = new Map<string, number>();
  for (const b of badges) familySize.set(b.family, (familySize.get(b.family) ?? 0) + 1);
  const q = query.trim().toLowerCase();
  const visible = badges.filter(
    (b) =>
      (rarity === "all" || b.rarity === rarity) &&
      (show === "all" || (show === "have") === !!counts?.has(b.slug)) &&
      (!q || b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.family.includes(q)),
  );
  const RARITIES = ["all", "mythic", "anomaly", "epic", "rare", "uncommon", "common"];
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
      active ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
    }`;

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
      <p className="text-sm text-zinc-500">
        A badge&apos;s EP is its odds: a 1-in-5,000 badge pays 5,000 EP. Badges in the same family don&apos;t stack, so a
        roll only scores the best one it hits in each family.
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${badges.length} badges (try "prime", "777", "hex")`}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <div className="flex flex-wrap gap-2">
          {RARITIES.map((r) => (
            <button key={r} type="button" className={pill(rarity === r)} onClick={() => setRarity(r)}>
              {r === "all" ? "All rarities" : r}
            </button>
          ))}
        </div>
        {counts && (
          <div className="flex flex-wrap gap-2">
            {(["all", "have", "missing"] as const).map((v) => (
              <button key={v} type="button" className={pill(show === v)} onClick={() => setShow(v)}>
                {v === "all" ? "All" : v === "have" ? "Collected" : "Missing"}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          Showing {visible.length} of {badges.length}
        </p>
      </div>
      <ul key={`${rarity}|${show}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((b, idx) => {
          const times = counts?.get(b.slug) ?? 0;
          const owned = times > 0;
          const odds = badgeOneIn(b.slug);
          const color = tierColor(b.rarity);
          return (
            <li key={b.slug} className="lk-card lk-lift" style={{ ["--i" as string]: Math.min(idx, 18) }}>
              <BadgeAura slug={b.slug} rarity={b.rarity} active={owned} intensity={0.55}>
                <div
                  className={`flex h-full gap-3 rounded-xl border bg-zinc-900/90 p-4 ${owned ? "" : "opacity-45 grayscale"}`}
                  style={{ borderColor: owned ? `${color}88` : "rgb(39 39 42)" }}
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
                    {(familySize.get(b.family) ?? 0) > 1 && (
                      <p className="mt-1 text-[11px] text-zinc-500">Family: {b.family}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Chip value={b.rarity} />
                      <span className="text-xs tabular-nums text-violet-300">{formatNumber(b.ep)} EP</span>
                      {odds && <span className="text-xs text-zinc-500">{formatOdds(odds)}</span>}
                    </div>
                  </div>
                </div>
              </BadgeAura>
            </li>
          );
        })}
      </ul>
    </>
  );
}
