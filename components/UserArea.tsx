"use client";

import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth-context";
import { Avatar } from "./Avatar";

/** Header user area. */
export function UserArea() {
  const { status, displayName, avatarPath } = useAuth();

  if (status === "loading") {
    return <span className="h-8 w-20 animate-pulse rounded-lg bg-zinc-800" />;
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
      {displayName ? (
        <Link href="/account" className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100">
          <Avatar path={avatarPath} name={displayName} size={28} />
          <span className="max-w-[10rem] truncate">{displayName}</span>
        </Link>
      ) : displayName === null ? (
        <Link href="/welcome" className="text-violet-300 hover:text-violet-200">
          Choose a name
        </Link>
      ) : (
        <span className="h-5 w-16 animate-pulse rounded bg-zinc-800" />
      )}
      <Link href="/account" className="text-zinc-400 hover:text-zinc-100">
        Account
      </Link>
    </div>
  );
}
