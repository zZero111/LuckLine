import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-4 py-16 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none";

export const buttonClass =
  "w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50";

export function Loading() {
  return <p className="text-sm text-zinc-400">Loading…</p>;
}
