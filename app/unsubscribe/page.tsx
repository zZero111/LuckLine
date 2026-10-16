import { Suspense } from "react";
import { Unsubscribe } from "@/components/Unsubscribe";

export const metadata = { title: "Unsubscribe · Luckline" };

export default function UnsubscribePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Reminder emails</h1>
      <Suspense fallback={<p className="text-zinc-400">One moment…</p>}>
        <Unsubscribe />
      </Suspense>
    </div>
  );
}
