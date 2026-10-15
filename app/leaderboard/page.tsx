import Link from "next/link";
import { Suspense } from "react";
import { Chip } from "@/components/Chip";
import { SignInPrompt } from "@/components/SignInPrompt";
import { formatNumber } from "@/components/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Leaderboard · Luckline" };

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-900" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Tabs({ tab }: { tab: "today" | "all" }) {
  const cls = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-violet-600 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`;
  return (
    <nav className="flex gap-2">
      <Link href="/leaderboard" className={cls(tab === "today")}>
        Today
      </Link>
      <Link href="/leaderboard?tab=all" className={cls(tab === "all")}>
        All-Time
      </Link>
    </nav>
  );
}

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const td = "px-3 py-2";

async function Board({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const params = await searchParams;
  const tab = params.tab === "all" ? "all" : "today";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignInPrompt message="Sign in to see the leaderboard." />;

  if (tab === "today") {
    const { data, error } = await supabase.from("leaderboard_today").select("*").order("rank").limit(100);
    return (
      <>
        <Tabs tab={tab} />
        {error ? (
          <p className="text-rose-300">Could not load the leaderboard.</p>
        ) : !data?.length ? (
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
                {data.map((r, i) => (
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
        )}
      </>
    );
  }

  const { data, error } = await supabase.from("leaderboard_all_time").select("*").order("rank").limit(100);
  return (
    <>
      <Tabs tab={tab} />
      {error ? (
        <p className="text-rose-300">Could not load the leaderboard.</p>
      ) : !data?.length ? (
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
              {data.map((r, i) => (
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
