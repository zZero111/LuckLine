"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { useAuth } from "@/lib/supabase/auth-context";
import { APP_VERSION } from "@/lib/version";

const DISMISSED_KEY = "luckline:password-prompt-at";
const SEEN_VERSION_KEY = "luckline:seen-version";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const WHATS_NEW_CLOSED = "luckline:whatsnew-closed";

// Pages where the pop-up would get in the way (sign-in steps, or the page it points to).
const QUIET_PATHS = ["/account", "/auth", "/welcome", "/login", "/unsubscribe"];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function snoozed(): boolean {
  const at = Number(read(DISMISSED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
}

/**
 * Asks signed-in players who haven't set a password to do so on the Account
 * page. Waits until the "What's new" pop-up has been dismissed, and stays away
 * for a week after "Maybe later".
 */
export function PasswordPrompt() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { status, user, displayName } = useAuth();
  const [open, setOpen] = useState(false);

  const eligible =
    status === "signedIn" &&
    typeof displayName === "string" &&
    user?.user_metadata?.has_password !== true &&
    !QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!eligible) return;
    const check = () => {
      if (!snoozed() && read(SEEN_VERSION_KEY) === APP_VERSION) setOpen(true);
    };
    const id = window.setTimeout(check, 1200);
    window.addEventListener(WHATS_NEW_CLOSED, check);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(WHATS_NEW_CLOSED, check);
    };
  }, [eligible]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Storage blocked: it may show again on the next visit, which is harmless.
    }
    setOpen(false);
    sfx.close();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || !eligible) return null;

  return (
    <div className="lk-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={dismiss} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-prompt-title"
        className="lk-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-violet-500/40 bg-zinc-950 text-left shadow-2xl shadow-violet-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-violet-600/40 via-fuchsia-500/20 to-transparent px-6 pb-4 pt-6">
          <p className="text-2xl" aria-hidden>
            🔑
          </p>
          <h2 id="password-prompt-title" className="mt-1 text-2xl font-black tracking-tight">
            Add a password
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Skip the email link next time. Go to your Account page, set a password, and from then on you can sign in with just your email and password.
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            autoFocus
            onClick={() => {
              dismiss();
              router.push("/account#password");
            }}
            className="w-full rounded-xl bg-violet-600 py-3 font-bold text-white transition hover:bg-violet-500 active:scale-95"
          >
            Go to Account
          </button>
          <button type="button" onClick={dismiss} className="w-full rounded-xl py-2 text-sm text-zinc-400 hover:text-white">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
