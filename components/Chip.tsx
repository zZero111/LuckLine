const STYLES: Record<string, string> = {
  trash: "bg-stone-800 text-stone-400 ring-stone-700",
  common: "bg-zinc-800 text-zinc-200 ring-zinc-600",
  uncommon: "bg-emerald-950 text-emerald-300 ring-emerald-700",
  rare: "bg-sky-950 text-sky-300 ring-sky-700",
  epic: "bg-violet-950 text-violet-300 ring-violet-600",
  anomaly: "bg-amber-950 text-amber-300 ring-amber-600",
  mythic: "bg-rose-950 text-rose-300 ring-rose-500",
};

export function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Colour chip for a roll tier or a badge rarity. */
export function Chip({ value, size = "sm" }: { value: string | null | undefined; size?: "sm" | "lg" }) {
  const v = value ?? "common";
  const cls = STYLES[v] ?? STYLES.common;
  const sz = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset ${sz} ${cls}`}>
      {capitalize(v)}
    </span>
  );
}
