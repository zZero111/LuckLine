import { BadgesView } from "@/components/BadgesView";

export const metadata = { title: "Badges · Luckline" };

export default function BadgesPage() {
  return (
    <div className="flex flex-col gap-6">
      <BadgesView />
    </div>
  );
}
