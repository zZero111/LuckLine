"use client";

import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth-context";
import { Avatar } from "./Avatar";
import { PlayerName } from "./PlayerName";
import { formatNumber } from "./types";

/** Header user area. */
export function UserArea() {
  const { status, displayName, avatarPath, cosmetics, balance } = useAuth();

  if (status === "loading") {
    return <span className="h-8 w-20 lk-shimmer rounded-lg bg-zinc-800" />;
  }

  if (status === "signedOut") {
    return (
      <Link href="/login" className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {displayName && (
        <Link
          href="/shop"
          title="Your EP: spend it in the shop"
          className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold tabular-nums text-amber-300 transition hover:border-amber-400/60"
        >
          {formatNumber(balance)} EP
        </Link>
      )}
      {displayName ? (
        <Link href="/account" className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100">
          <Avatar path={avatarPath} name={displayName} size={28} frame={cosmetics.frame} />
          <PlayerName name={displayName} style={cosmetics.nameStyle} className="max-w-[10rem] truncate" />
        </Link>
      ) : displayName === null ? (
        <Link href="/welcome" className="text-violet-300 hover:text-violet-200">
          Choose a name
        </Link>
      ) : (
        <span className="h-5 w-16 lk-shimmer rounded bg-zinc-800" />
      )}
      <Link href="/account" className="text-zinc-400 hover:text-zinc-100">
        Account
      </Link>
    </div>
  );
}
