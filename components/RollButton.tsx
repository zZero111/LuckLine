"use client";


/** Turns a roll_today / reroll_today error into a friendly message. */
export function friendlyError(message: string): { text: string; href?: string; label?: string; refresh?: boolean } {
  if (message.includes("already rolled today")) return { text: "You've already rolled today.", refresh: true };
  if (message.includes("choose a display name first")) {
    return { text: "Pick a display name before your first roll.", href: "/welcome", label: "Choose a name" };
  }
  if (message.includes("not signed in")) {
    return { text: "Your session has expired. Please sign in again.", href: "/login", label: "Sign in" };
  }
  if (message.includes("not enough EP")) return { text: "You don't have enough EP for a reroll.", refresh: true };
  if (message.includes("no rerolls left today")) return { text: "No rerolls left today. Come back tomorrow!", refresh: true };
  if (message.includes("roll today first")) return { text: "Take your daily roll first.", refresh: true };
  return { text: "Something went wrong while rolling. Please try again." };
}

/** The big daily Roll button. `label` and `color` restyle it for events; `note` adds a line under it. */
export function RollButton({
  onRoll,
  streakBefore = 0,
  label = "ROLL",
  color,
  note,
}: {
  onRoll: () => void;
  streakBefore?: number;
  label?: string;
  color?: string;
  note?: string | null;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <button
        type="button"
        onClick={onRoll}
        data-sfx="rattle"
        className={`lk-pulse flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-6 text-3xl font-black uppercase tracking-wider text-white transition hover:scale-[1.02] active:scale-95 ${color ? "" : "bg-violet-600 hover:bg-violet-500"}`}
        style={color ? { background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 55%, #7f1d1d))`, boxShadow: `0 0 36px ${color}55` } : undefined}
      >
        <span aria-hidden>🎲</span>
        {label}
      </button>
      {note && <p className="text-center text-sm text-zinc-300">{note}</p>}
      <p className="text-sm text-zinc-500">
        {streakBefore > 0 ? `🔥 ${streakBefore}-day streak. Keep it going.` : "One shot. Make it count."}
      </p>
    </div>
  );
}
