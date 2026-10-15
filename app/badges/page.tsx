import { BadgesView } from "@/components/BadgesView";

export const metadata = { title: "Badges · Luckline" };

export default function BadgesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Badge collection</h1>
      <BadgesView />
    </div>
  );
}
