"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSections, MIN_FUSION_SIZE, type AlbumBadge, type AlbumSection } from "@/lib/badges/albumGroups";
import { badgeOneIn, formatOdds } from "@/lib/game/odds";
import { sfx } from "@/lib/game/sfx";
import { tierColor } from "@/lib/game/tiers";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { BadgeAura } from "./BadgeAura";
import { Chip } from "./Chip";
import { FusionPanel } from "./FusionPanel";
import { HexBadge } from "./HexBadge";
import { SignInPrompt } from "./SignInPrompt";
import { formatNumber } from "./types";

type Reward = { pct: number; ep: number; cosmetic: string | null; label: string };
type Loaded = {
  badges: AlbumBadge[];
  counts: Map<string, number> | null;
  fused: Set<string>;
  rewards: Reward[];
  claimed: Set<number>;
  failed: boolean;
};

type Filter = "all" | "owned" | "missing" | "mythic" | "anomaly" | "epic";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "missing", label: "Missing" },
  { id: "mythic", label: "Mythic" },
  { id: "anomaly", label: "Anomaly" },
  { id: "epic", label: "Epic" },
];

type State = "owned" | "next" | "hidden";

function Lock() {
  return (
    <svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden className="text-zinc-500">
      <path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z" />
    </svg>
  );
}

/** Progress ring with the percentage inside. */
function Ring({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-32 w-32 shrink-0 place-items-center" role="img" aria-label={`${pct}% of the album collected`}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#27272a" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <span className="text-3xl font-black tabular-nums">{pct}%</span>
    </div>
  );
}

/** A badge's details: owned, the next one to find, or a hidden one. */
function Detail({ badge, state, times, family, onClose }: { badge: AlbumBadge; state: State; times: number; family: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const odds = badgeOneIn(badge.slug);
  const color = tierColor(badge.rarity);
  return (
    <div className="lk-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={state === "hidden" ? "Hidden badge" : badge.name}
        className="lk-pop w-full max-w-sm rounded-3xl border bg-zinc-950 p-5 text-center shadow-2xl"
        style={{ borderColor: state === "owned" ? `${color}99` : "#3f3f46" }}
        onClick={(e) => e.stopPropagation()}
      >
        {state === "hidden" ? (
          <>
            <div className="flex justify-center">
              <HexBadge color="#52525b" size={88} locked dashed>
                <Lock />
              </HexBadge>
            </div>
            <h2 className="mt-3 text-2xl font-black text-zinc-300">Hidden badge</h2>
            <p className="mt-1 text-sm text-zinc-400">Keep rolling and collect the badges before it in this section to reveal it.</p>
          </>
        ) : (
          <BadgeAura slug={badge.slug} rarity={badge.rarity} active={state === "owned"} intensity={0.7} className="rounded-2xl">
            <div className="rounded-2xl bg-zinc-950 p-2">
              <div className="flex justify-center">
                <HexBadge color={color} size={96} locked={state !== "owned"} dashed={state !== "owned"} glow>
                  {state === "owned" ? badge.emoji : <Lock />}
                </HexBadge>
              </div>
              <h2 className={`mt-3 text-2xl font-black ${state === "owned" ? "" : "text-zinc-300"}`}>{badge.name}</h2>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Chip value={badge.rarity} />
                <span className="text-sm font-semibold tabular-nums text-violet-300">{formatNumber(badge.ep)} EP</span>
                {odds && <span className="text-sm text-zinc-500">{formatOdds(odds)}</span>}
              </div>
              <p className="mt-3 text-zinc-300">{badge.description}</p>
              <p className="mt-3 text-sm text-zinc-500">
                {state === "owned" ? `Earned ${times} ${times === 1 ? "time" : "times"}` : "Not found yet. This is the next one to find in its section."}
              </p>
              {family && <p className="mt-1 text-xs text-zinc-600">Family: {family}. Only the best badge in a family counts for a roll.</p>}
            </div>
          </BadgeAura>
        )}
        <button type="button" onClick={onClose} autoFocus className="mt-4 w-full rounded-xl border border-zinc-700 py-2 font-semibold text-zinc-200 hover:bg-zinc-800">
          Close
        </button>
      </div>
    </div>
  );
}

/** The badge album: every badge grouped by family, with locked ones hidden until you get close. */
export function BadgesView() {
  const { status, user, refreshProfile } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState<{ badge: AlbumBadge; state: State; family: string } | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    const supabase = createClient();
    const catalog = supabase.from("badges").select("slug, name, emoji, family, description, rarity, ep");
    const mine = userId
      ? supabase.from("rolls").select("roll_badges(badges(slug))").eq("user_id", userId).limit(1000)
      : Promise.resolve(null);
    const fusions = userId ? supabase.from("family_fusions").select("family").eq("user_id", userId) : Promise.resolve(null);
    const rewards = userId ? supabase.from("album_rewards").select("pct, ep, cosmetic, label").order("pct") : Promise.resolve(null);
    const claims = userId ? supabase.from("album_claims").select("pct").eq("user_id", userId) : Promise.resolve(null);
    Promise.all([catalog, mine, fusions, rewards, claims]).then(([cat, own, fus, rew, clm]) => {
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
      setData({
        badges: (cat.data ?? []) as AlbumBadge[],
        counts,
        fused: new Set((fus?.data ?? []).map((f) => f.family)),
        rewards: (rew?.data ?? []) as Reward[],
        claimed: new Set((clm?.data ?? []).map((c) => c.pct)),
        failed: !!cat.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [status, userId, version]);

  const sections = useMemo(() => (data ? buildSections(data.badges) : []), [data]);

  if (status === "signedOut") return <SignInPrompt message="Sign in and roll to start your badge album." />;
  if (!data) return <div className="h-64 lk-shimmer rounded-xl bg-zinc-900" />;
  if (data.failed) return <p className="text-rose-300">Could not load the badges.</p>;

  const { badges, counts, fused, rewards, claimed } = data;
  const owned = new Set(counts ? [...counts.keys()] : []);
  const collected = badges.filter((b) => owned.has(b.slug)).length;
  const pct = badges.length ? Math.floor((100 * collected) / badges.length) : 0;
  const rarest = badges.filter((b) => owned.has(b.slug)).sort((a, b) => b.ep - a.ep)[0];
  const rarestOdds = rarest ? badgeOneIn(rarest.slug) : null;
  const q = query.trim().toLowerCase();
  const filtering = filter !== "all" || q !== "";
  const nextReward = rewards.find((r) => !claimed.has(r.pct) && r.pct > pct);
  const needed = nextReward ? Math.ceil((badges.length * nextReward.pct) / 100) : 0;
  const fusable = sections.filter((s) => s.family && s.badges.length >= MIN_FUSION_SIZE);

  const stateOf = (sec: AlbumSection, i: number): State => {
    if (owned.has(sec.badges[i].slug)) return "owned";
    return sec.badges.findIndex((b) => !owned.has(b.slug)) === i ? "next" : "hidden";
  };

  const shown = sections
    .map((sec) => {
      const items = sec.badges
        .map((badge, i) => ({ badge, state: stateOf(sec, i) }))
        .filter(({ badge, state }) => {
          if (filter === "owned" && state !== "owned") return false;
          if (filter === "missing" && state === "owned") return false;
          if ((filter === "mythic" || filter === "anomaly" || filter === "epic") && badge.rarity !== filter) return false;
          if (q) {
            if (state === "hidden") return false;
            return badge.name.toLowerCase().includes(q) || badge.description.toLowerCase().includes(q) || sec.title.toLowerCase().includes(q);
          }
          return true;
        });
      const have = sec.badges.filter((b) => owned.has(b.slug)).length;
      return { sec, items, have };
    })
    .filter((x) => x.items.length > 0)
    .sort((a, b) => {
      const fa = a.have / a.sec.badges.length;
      const fb = b.have / b.sec.badges.length;
      return (b.have > 0 ? 1 : 0) - (a.have > 0 ? 1 : 0) || fb - fa || b.sec.badges.length - a.sec.badges.length;
    });

  // Sections you haven't started stay folded away until you ask, unless you're searching or filtering.
  const started = shown.filter((x) => x.have > 0);
  const notStarted = shown.length - started.length;
  const visibleSections = filtering || showAll || started.length === 0 ? shown : started;

  const isOpen = (key: string, have: number) => (filtering ? true : opened.has(key) || (have > 0 && !closed.has(key)));
  const toggle = (key: string, have: number) => {
    sfx.click();
    const open = isOpen(key, have);
    if (open) {
      setClosed((c) => new Set(c).add(key));
      setOpened((o) => {
        const n = new Set(o);
        n.delete(key);
        return n;
      });
    } else {
      setOpened((o) => new Set(o).add(key));
      setClosed((c) => {
        const n = new Set(c);
        n.delete(key);
        return n;
      });
    }
  };

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${active ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`;

  return (
    <>
      <div className="flex items-center gap-5">
        <Ring pct={pct} />
        <div className="min-w-0">
          <h1 className="text-4xl font-black tracking-tight">Badge Album</h1>
          {counts ? (
            <>
              <p className="text-lg text-zinc-300">
                <b className="text-zinc-50">{collected}</b> of {badges.length} collected
              </p>
              <p className="text-sm text-zinc-500">
                {rarest ? `Rarest: ${rarest.name}${rarestOdds ? `, ${formatOdds(rarestOdds)}` : ""}` : "Roll to find your first badge"}
              </p>
            </>
          ) : (
            <p className="text-zinc-400">Roll to start your collection.</p>
          )}
        </div>
      </div>

      {counts && <FusionPanel families={fusable} owned={owned} fused={fused} onFused={() => { setVersion((v) => v + 1); void refreshProfile(); }} />}

      <div className="relative">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${badges.length} badges`}
          aria-label="Search badges"
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-lg outline-none placeholder:text-zinc-500 focus:border-violet-500"
        />
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filters">
        {FILTERS.filter((f) => counts || (f.id !== "owned" && f.id !== "missing")).map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} className={chip(filter === f.id)} onClick={() => { sfx.click(); setFilter(f.id); }}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-zinc-500">
        A badge&apos;s EP is its odds: a 1-in-5,000 badge pays 5,000 EP. Badges in the same family don&apos;t stack, so a roll only scores the best one it hits in each family.
      </p>

      {!shown.length && <p className="text-zinc-400">No badges match that.</p>}
      <div className="flex flex-col gap-6">
        {visibleSections.map(({ sec, items, have }) => {
          const open = isOpen(sec.key, have);
          const complete = have === sec.badges.length;
          return (
            <section key={sec.key} aria-label={sec.title}>
              <button type="button" onClick={() => toggle(sec.key, have)} aria-expanded={open} className="flex w-full items-baseline justify-between gap-2 text-left">
                <h2 className="text-xl font-black tracking-tight">
                  {sec.title}
                  {sec.family && fused.has(sec.family) && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 align-middle text-[11px] font-black uppercase tracking-wider text-amber-300">★ Master</span>}
                  {sec.family && !fused.has(sec.family) && complete && sec.badges.length >= MIN_FUSION_SIZE && (
                    <span className="ml-2 rounded-full bg-violet-400/20 px-2 py-0.5 align-middle text-[11px] font-black uppercase tracking-wider text-violet-300">Ready to fuse</span>
                  )}
                </h2>
                <span className="shrink-0 text-sm tabular-nums text-zinc-400">
                  {have} of {sec.badges.length} <span aria-hidden>{open ? "▾" : "▸"}</span>
                </span>
              </button>
              {open && (
                <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
                  {items.map(({ badge, state }, idx) => (
                    <li key={badge.slug} className="lk-card" style={{ ["--i" as string]: Math.min(idx, 12) }}>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.click();
                          setDetail({ badge, state, family: sec.family ? sec.title : "" });
                        }}
                        className="lk-lift flex w-full flex-col items-center gap-1.5 rounded-xl p-1"
                        aria-label={state === "hidden" ? "Hidden badge" : `${badge.name}${state === "owned" ? "" : " (not found yet)"}`}
                      >
                        <HexBadge color={tierColor(badge.rarity)} size={62} locked={state !== "owned"} dashed={state !== "owned"} glow={state === "owned"}>
                          {state === "owned" ? badge.emoji : <Lock />}
                        </HexBadge>
                        <span className={`line-clamp-2 text-center text-xs font-semibold leading-tight ${state === "owned" ? "text-zinc-100" : state === "next" ? "text-zinc-500" : "text-zinc-600"}`}>
                          {state === "hidden" ? "Hidden" : badge.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {!filtering && !showAll && started.length > 0 && notStarted > 0 && (
        <button
          type="button"
          onClick={() => {
            sfx.click();
            setShowAll(true);
          }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
        >
          Show {notStarted} more {notStarted === 1 ? "section" : "sections"} you haven&apos;t started
        </button>
      )}

      {counts && (
        <section className="rounded-3xl border border-violet-600/50 bg-gradient-to-br from-violet-950/70 to-zinc-900/70 p-4" aria-label="Next album reward">
          {nextReward ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-black">Next reward at {nextReward.pct}%</h3>
                <span className="text-sm font-bold text-violet-300">{nextReward.label}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${Math.min(100, (100 * collected) / Math.max(1, needed))}%` }} />
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {Math.max(0, needed - collected)} more {needed - collected === 1 ? "badge" : "badges"} to go
              </p>
            </>
          ) : (
            <p className="text-center font-bold text-violet-200">You&apos;ve claimed every album reward. Legend.</p>
          )}
        </section>
      )}

      {detail && <Detail badge={detail.badge} state={detail.state} times={counts?.get(detail.badge.slug) ?? 0} family={detail.family} onClose={() => setDetail(null)} />}
    </>
  );
}
