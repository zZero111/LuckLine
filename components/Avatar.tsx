"use client";

import { useState } from "react";
import { avatarUrl } from "@/lib/avatars";

const COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#e11d48", "#d946ef", "#14b8a6", "#6366f1"];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

/** A player's picture, or a coloured initial when they don't have one. */
export function Avatar({ path, name, size = 32 }: { path?: string | null; name?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const label = name ?? "?";
  const style = { width: size, height: size };

  if (path && failed !== path) {
    return (
      // Avatars come from Supabase Storage; next/image optimisation is off for the static export.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl(path)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(path)}
        className="shrink-0 rounded-full bg-zinc-800 object-cover ring-1 ring-zinc-700"
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ring-1 ring-black/20"
      style={{ ...style, background: colorFor(label), fontSize: size * 0.45 }}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
