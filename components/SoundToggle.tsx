"use client";

import { useState } from "react";
import { setSoundEnabled, sfx, soundEnabled } from "@/lib/game/sfx";

export function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setSoundEnabled(next);
        setOn(next);
        if (next) sfx.lock(4);
      }}
      aria-pressed={on}
      title={on ? "Sound on" : "Sound off"}
      className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
    >
      {on ? "🔊" : "🔇"}
      <span className="sr-only">{on ? "Turn sound off" : "Turn sound on"}</span>
    </button>
  );
}
