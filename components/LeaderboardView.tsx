"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Chip } from "./Chip";
import { SignInPrompt } from "./SignInPrompt";
import { formatNumber } from "./types";

type TodayRow = Database["public"]["Views"]["leaderboard_today"]["Row"];
type AllTimeRow = Database["public"]["Views"]["leaderboard_all_time"]["Row"];
type Loaded<T> = { rows: T[]; failed: boolean };

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const td = "px-3 py-2";
const skeleton = <div className="h-64 animate-pulse rounded-xl bg-zinc-900" />;

function Tabs({ tab, onChange }: { tab: "today" | "all"; onChange: (t: "today" | "all") => void }) {
  const cls = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-violet-600 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`;
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

export function LeaderboardView() {
  const { status, user } = useAuth();
  const [tab, setTab] = useState<"today" | "all">("today");
  const [today, setToday] = useState<Loaded<TodayRow> | undefined>(undefined);
  const [allTime, setAllTime] = useState<Loaded<AllTimeRow> | undefined>(undefined);
  const userId = user?.id;

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
  }, [userId, tab]);

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
  }, [userId, tab]);

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
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
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
                  <tr key={`${r.rank}-${r.display_name}-${i}`}>
                    <td className={`${td} tabular-nums text-zinc-500`}>{r.rank}</td>
                    <td className={`${td} font-medium`}>{r.display_name}</td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{r.number != null ? formatNumber(r.number) : ""}</td>
                    <td className={`${td} text-right tabular-nums text-violet-300`}>{r.ep}</td>
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
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
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
                <tr key={`${r.rank}-${r.display_name}-${i}`}>
                  <td className={`${td} tabular-nums text-zinc-500`}>{r.rank}</td>
                  <td className={`${td} font-medium`}>{r.display_name}</td>
                  <td className={`${td} text-right tabular-nums text-violet-300`}>{r.total_ep != null ? formatNumber(r.total_ep) : ""}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.best_ep}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.roll_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
