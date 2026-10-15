import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata = { title: "Leaderboard · Luckline" };

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
      <LeaderboardView />
    </div>
  );
}
