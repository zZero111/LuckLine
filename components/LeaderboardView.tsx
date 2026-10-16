"use client";

import { useCallback, useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET } from "@/lib/avatars";
import { Avatar } from "./Avatar";
import { Chip } from "./Chip";
import { PlayerStatsModal } from "./PlayerStatsModal";
import { SignInPrompt } from "./SignInPrompt";
import { formatNumber, wheelTag } from "./types";

type TodayRow = Database["public"]["Views"]["leaderboard_today"]["Row"];
type AllTimeRow = Database["public"]["Views"]["leaderboard_all_time"]["Row"];
type Loaded<T> = { rows: T[]; failed: boolean };

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const td = "px-3 py-2";
const skeleton = <div className="h-64 lk-shimmer rounded-xl bg-zinc-900" />;

const MEDALS = ["🥇", "🥈", "🥉"];

/** The rank cell: medals for the top three. */
function Rank({ rank }: { rank: number | null }) {
  if (rank != null && rank >= 1 && rank <= 3) {
    return (
      <span className="lk-medal text-lg" title={`#${rank}`} style={{ animationDelay: `${rank * 0.4}s` }}>
        {MEDALS[rank - 1]}
      </span>
    );
  }
  return <>{rank}</>;
}

/** Gold, silver and bronze for the top three. */
const PODIUM = ["#fbbf24", "#cbd5e1", "#e0883e"];

/** Row styling: a coloured frame for the podium, a violet tint for you. */
function rowClass(rank: number | null, mine: boolean) {
  const podium = rank != null && rank >= 1 && rank <= 3 ? `lk-podium lk-podium-${rank}` : "";
  return `lk-row transition-colors hover:bg-zinc-900/70 ${podium} ${mine ? "bg-violet-500/10" : ""}`;
}

/** The CSS variable the podium frame is drawn with. */
function rowStyle(i: number, rank: number | null) {
  const style: Record<string, string | number> = { "--i": Math.min(i, 14) };
  if (rank != null && rank >= 1 && rank <= 3) style["--m"] = PODIUM[rank - 1];
  return style;
}

function Tabs({ tab, onChange }: { tab: "today" | "all"; onChange: (t: "today" | "all") => void }) {
  const cls = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`;
  return (
    <nav className="flex gap-2">
      <button type="button" onClick={() => onChange("today")} className={cls(tab === "today")}>
        Today
      </button>
      <button type="button" onClick={() => onChange("all")} className={cls(tab === "all")}>
        All-Time
      </button>
    </nav>
  );
}

/** Avatar + name; admins also get a button to remove the picture. */
function PlayerCell({
  name,
  avatarPath,
  isAdmin,
  onRemoved,
  onOpen,
}: {
  name: string | null;
  avatarPath: string | null;
  isAdmin: boolean;
  onRemoved: () => void;
  onOpen: (name: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!name || !window.confirm(`Remove ${name}'s profile picture? They won't be able to upload a new one.`)) return;
    setBusy(true);
    const supabase = createClient();
    const { data: path, error } = await supabase.rpc("admin_remove_avatar", { target_name: name });
    if (!error && path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    setBusy(false);
    if (error) window.alert("Couldn't remove that picture.");
    else onRemoved();
  }
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => name && onOpen(name)}
        className="flex min-w-0 items-center gap-2 rounded-lg text-left hover:text-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
        title="See stats"
      >
        <Avatar path={avatarPath} name={name} size={28} />
        <span className="truncate underline decoration-zinc-700 decoration-dotted underline-offset-4">{name}</span>
      </button>
      {isAdmin && avatarPath && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          title="Remove this profile picture (admin)"
          className="rounded px-1.5 text-xs text-rose-300 hover:bg-rose-950 disabled:opacity-50"
        >
          {busy ? "…" : "🗑"}
        </button>
      )}
    </span>
  );
}

export function LeaderboardView() {
  const { status, user, displayName } = useAuth();
  const [tab, setTab] = useState<"today" | "all">("today");
  const [today, setToday] = useState<Loaded<TodayRow> | undefined>(undefined);
  const [allTime, setAllTime] = useState<Loaded<AllTimeRow> | undefined>(undefined);
  const userId = user?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [reload, setReload] = useState(0);
  const [openName, setOpenName] = useState<string | null>(null);
  const closeStats = useCallback(() => setOpenName(null), []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    createClient()
      .rpc("am_i_admin")
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(data === true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || tab !== "today") return;
    let cancelled = false;
    createClient()
      .from("leaderboard_today")
      .select("*")
      .order("rank")
      .limit(100)
      .then(({ data, error }) => {
        if (!cancelled) setToday({ rows: data ?? [], failed: !!error });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, tab, reload]);

  useEffect(() => {
    if (!userId || tab !== "all") return;
    let cancelled = false;
    createClient()
      .from("leaderboard_all_time")
      .select("*")
      .order("rank")
      .limit(100)
      .then(({ data, error }) => {
        if (!cancelled) setAllTime({ rows: data ?? [], failed: !!error });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, tab, reload]);

  if (status === "loading") return skeleton;
  if (status === "signedOut") return <SignInPrompt message="Sign in to see the leaderboard." />;

  const current = tab === "today" ? today : allTime;

  return (
    <>
      <Tabs tab={tab} onChange={setTab} />
      {!current ? (
        skeleton
      ) : current.failed ? (
        <p className="text-rose-300">Could not load the leaderboard.</p>
      ) : tab === "today" ? (
        !today?.rows.length ? (
          <p className="text-zinc-400">Nobody has rolled yet today. Be the first!</p>
        ) : (
          <div key="today" className="lk-tab-in overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Player</th>
                  <th className={`${th} text-right`}>Number</th>
                  <th className={`${th} text-right`}>EP</th>
                  <th className={th}>Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {today.rows.map((r, i) => (
                  <tr key={`${r.rank}-${r.display_name}-${i}`} className={rowClass(r.rank, r.display_name === displayName)} style={rowStyle(i, r.rank)}>
                    <td className={`${td} tabular-nums text-zinc-500`}>
                      <Rank rank={r.rank} />
                    </td>
                    <td className={`${td} font-medium`}>
                      <PlayerCell name={r.display_name} avatarPath={r.avatar_path} isAdmin={isAdmin} onRemoved={() => setReload((n) => n + 1)} onOpen={setOpenName} />
                    </td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{r.number != null ? formatNumber(r.number) : ""}</td>
                    <td className={`${td} text-right tabular-nums text-violet-300`}>
                      {r.ep != null ? formatNumber(r.ep) : ""}
                      {wheelTag(r.multiplier, r.bonus_ep) && (
                        <span className="ml-1 text-xs text-amber-300">🎡{wheelTag(r.multiplier, r.bonus_ep)}</span>
                      )}
                    </td>
                    <td className={td}>
                      <Chip value={r.tier} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : !allTime?.rows.length ? (
        <p className="text-zinc-400">No rolls yet.</p>
      ) : (
        <div key="all" className="lk-tab-in overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className={th}>#</th>
                <th className={th}>Player</th>
                <th className={`${th} text-right`}>Total EP</th>
                <th className={`${th} text-right`}>Best EP</th>
                <th className={`${th} text-right`}>Rolls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {allTime.rows.map((r, i) => (
                <tr key={`${r.rank}-${r.display_name}-${i}`} className={rowClass(r.rank, r.display_name === displayName)} style={rowStyle(i, r.rank)}>
                  <td className={`${td} tabular-nums text-zinc-500`}>
                    <Rank rank={r.rank} />
                  </td>
                  <td className={`${td} font-medium`}>
                    <PlayerCell name={r.display_name} avatarPath={r.avatar_path} isAdmin={isAdmin} onRemoved={() => setReload((n) => n + 1)} onOpen={setOpenName} />
                  </td>
                  <td className={`${td} text-right tabular-nums text-violet-300`}>{r.total_ep != null ? formatNumber(r.total_ep) : ""}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.best_ep != null ? formatNumber(r.best_ep) : ""}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.roll_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openName && <PlayerStatsModal name={openName} onClose={closeStats} />}
    </>
  );
}
