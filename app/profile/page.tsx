import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Chip } from "@/components/Chip";
import { formatNumber } from "@/components/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile · Luckline" };

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-900" />}>
        <History />
      </Suspense>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const td = "px-3 py-2";

async function History() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: totals }, { data: rolls, error }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("leaderboard_totals").select("total_ep, best_ep, roll_count").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("rolls")
      .select("id, roll_date, number, ep, tier, roll_badges(badges(emoji, ep))")
      .eq("user_id", user.id)
      .order("roll_date", { ascending: false })
      .limit(100),
  ]);

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{profile?.display_name ?? "Your profile"}</h1>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total EP" value={formatNumber(totals?.total_ep ?? 0)} />
        <Stat label="Best EP" value={formatNumber(totals?.best_ep ?? 0)} />
        <Stat label="Rolls" value={formatNumber(totals?.roll_count ?? 0)} />
      </div>
      <h2 className="text-xl font-semibold">History</h2>
      {error ? (
        <p className="text-rose-300">Could not load your rolls.</p>
      ) : !rolls?.length ? (
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
              {rolls.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} tabular-nums text-zinc-400`}>{r.roll_date}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{formatNumber(r.number)}</td>
                  <td className={`${td} text-right tabular-nums text-violet-300`}>{r.ep}</td>
                  <td className={td}>
                    <Chip value={r.tier} />
                  </td>
                  <td className={td}>
                    {r.roll_badges
                      .map((rb) => rb.badges)
                      .filter((b) => b !== null)
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
