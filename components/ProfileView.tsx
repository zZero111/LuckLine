"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";
import { Chip } from "./Chip";
import { CountUp } from "./CountUp";
import { formatNumber, wheelTag } from "./types";

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const td = "px-3 py-2";
const skeleton = <div className="h-64 lk-shimmer rounded-xl bg-zinc-900" />;

function Stat({ label, value, prefix = "", i = 0 }: { label: string; value: number; prefix?: string; i?: number }) {
  return (
    <div className="lk-card lk-lift rounded-xl border border-zinc-800 bg-zinc-900/60 p-4" style={{ ["--i" as string]: i }}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {prefix}
        <CountUp value={value} />
      </p>
    </div>
  );
}

type Totals = { total_ep: number | null; best_ep: number | null; roll_count: number | null } | null;
type HistoryRoll = {
  id: string | number;
  roll_date: string;
  attempt: number;
  number: number;
  multiplier: number;
  bonus_ep: number;
  ep: number;
  tier: string;
  roll_badges: { badges: { emoji: string; ep: number } | null }[];
};
type Loaded = { userId: string; totals: Totals; balance: number; rolls: HistoryRoll[]; failed: boolean };

export function ProfileView() {
  const router = useRouter();
  const { status, user, displayName, avatarPath } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.from("leaderboard_totals").select("total_ep, best_ep, roll_count").eq("user_id", userId).maybeSingle(),
      supabase
        .from("rolls")
        .select("id, roll_date, attempt, number, ep, multiplier, bonus_ep, tier, roll_badges(badges(emoji, ep))")
        .eq("user_id", userId)
        .order("roll_date", { ascending: false })
        .order("attempt", { ascending: false })
        .limit(100),
      supabase.from("ep_wallets").select("balance").eq("user_id", userId).maybeSingle(),
    ]).then(([totals, rolls, wallet]) => {
      if (cancelled) return;
      setData({
        userId,
        totals: totals.data ?? null,
        balance: Number(wallet.data?.balance ?? 0),
        rolls: (rolls.data ?? []) as HistoryRoll[],
        failed: !!rolls.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (status !== "signedIn" || !data || data.userId !== userId) return skeleton;

  const { totals, balance, rolls, failed } = data;

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar path={avatarPath} name={displayName} size={64} />
        <h1 className="text-3xl font-bold tracking-tight">{displayName ?? "Your profile"}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat i={0} label="Score (best per day)" value={totals?.total_ep ?? 0} />
        <Stat i={1} label="Best roll" value={totals?.best_ep ?? 0} />
        <Stat i={2} label="Days played" value={totals?.roll_count ?? 0} />
        <Stat i={3} label="EP to spend" value={balance} prefix="💰 " />
      </div>
      <h2 className="text-xl font-semibold">History</h2>
      {failed ? (
        <p className="text-rose-300">Could not load your rolls.</p>
      ) : !rolls.length ? (
        <p className="text-zinc-400">No rolls yet. Head to Play and take your first one.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className={th}>Date</th>
                <th className={`${th} text-right`}>Number</th>
                <th className={`${th} text-right`}>EP</th>
                <th className={th}>Tier</th>
                <th className={th}>Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rolls.map((r, i) => (
                <tr key={r.id} className="lk-row transition-colors hover:bg-zinc-900/70" style={{ ["--i" as string]: Math.min(i, 14) }}>
                  <td className={`${td} tabular-nums text-zinc-400`}>
                    {r.roll_date}
                    {r.attempt > 0 && <span className="ml-2 text-xs text-amber-300/80">reroll {r.attempt}</span>}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{formatNumber(r.number)}</td>
                  <td className={`${td} text-right tabular-nums text-violet-300`}>
                    {formatNumber(r.ep)}
                    {wheelTag(r.multiplier, r.bonus_ep) && (
                      <span className="ml-1 text-xs text-amber-300">🎡{wheelTag(r.multiplier, r.bonus_ep)}</span>
                    )}
                  </td>
                  <td className={td}>
                    <Chip value={r.tier} />
                  </td>
                  <td className={td}>
                    {r.roll_badges
                      .map((rb) => rb.badges)
                      .filter((b): b is { emoji: string; ep: number } => b !== null)
                      .sort((a, b) => b.ep - a.ep)
                      .map((b) => b.emoji)
                      .join(" ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
