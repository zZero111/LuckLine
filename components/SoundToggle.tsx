"use client";

import { useSyncExternalStore } from "react";
import { onSoundChange, setSoundEnabled, sfx, soundEnabled } from "@/lib/game/sfx";

/** Mute button. Every instance on the page stays in sync. */
export function SoundToggle({ compact = false }: { compact?: boolean }) {
  const on = useSyncExternalStore(onSoundChange, soundEnabled, () => true);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setSoundEnabled(next);
        if (next) sfx.toggle(true);
      }}
      aria-pressed={on}
      data-sfx="none"
      title={on ? "Sound on (click to mute)" : "Sound off (click to unmute)"}
      className={`rounded-lg border border-zinc-700 text-zinc-300 transition hover:bg-zinc-800 ${compact ? "px-2 py-1 text-sm" : "px-3 py-2 text-sm"}`}
    >
      {on ? "🔊" : "🔇"}
      <span className="sr-only">{on ? "Turn sound off" : "Turn sound on"}</span>
    </button>
  );
}
