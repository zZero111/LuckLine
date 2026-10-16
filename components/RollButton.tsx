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

/** The big daily Roll button. */
export function RollButton({ onRoll, streakBefore = 0 }: { onRoll: () => void; streakBefore?: number }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <button
        type="button"
        onClick={onRoll}
        data-sfx="rattle"
        className="lk-pulse rounded-2xl bg-violet-600 px-16 py-7 text-4xl font-black tracking-wide text-white transition hover:scale-105 hover:bg-violet-500 active:scale-95"
      >
        ROLL
      </button>
      <p className="text-sm text-zinc-500">
        {streakBefore > 0 ? `🔥 ${streakBefore}-day streak. Keep it going.` : "One shot. Make it count."}
      </p>
    </div>
  );
}
