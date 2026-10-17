"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { useAuth } from "@/lib/supabase/auth-context";
import { APP_VERSION, CHANGELOG } from "@/lib/version";
import { WHATS_NEW_CLOSED } from "./PasswordPrompt";

const KEY = "luckline:seen-version";

function seenVersion(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, APP_VERSION);
  } catch {
    // Storage blocked: the pop-up may show again next visit, which is harmless.
  }
}

/** Shows the changelog once per version when a signed-in player visits; reopen from the footer. */
export function WhatsNew() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "signedIn" && seenVersion() !== APP_VERSION) {
      const id = window.setTimeout(() => setOpen(true), 400);
      return () => window.clearTimeout(id);
    }
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    markSeen();
    setOpen(false);
    sfx.close();
    window.dispatchEvent(new Event(WHATS_NEW_CLOSED));
  }

  function show() {
    setOpen(true);
    sfx.open();
  }

  const entry = CHANGELOG[0];
  const earlier = CHANGELOG.slice(1);

  return (
    <>
      <button
        type="button"
        onClick={show}
        data-sfx="none"
        className="text-xs text-zinc-600 underline-offset-4 hover:text-zinc-300 hover:underline"
      >
        v{APP_VERSION} · What&apos;s new
      </button>
      {open && (
        <div className="lk-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={close} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
            className="lk-pop relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-violet-500/40 bg-zinc-950 text-left shadow-2xl shadow-violet-900/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-violet-600/40 via-fuchsia-500/20 to-transparent px-6 pb-4 pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Luckline {entry.version}</p>
              <h2 id="whats-new-title" className="mt-1 text-3xl font-black tracking-tight">
                What&apos;s new 🎉
              </h2>
              <p className="mt-1 text-sm text-zinc-300">{entry.title}. Here&apos;s everything that changed:</p>
            </div>
            <ul className="flex flex-col gap-3 px-6 py-4">
              {entry.items.map((item, i) => (
                <li key={i} className="lk-fade flex gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="text-2xl leading-7" aria-hidden>
                    {item.emoji}
                  </span>
                  <span className="text-sm leading-relaxed text-zinc-200">{item.text}</span>
                </li>
              ))}
            </ul>
            {earlier.map((old) => (
              <details key={old.version} className="border-t border-zinc-800 px-6 py-3 text-sm">
                <summary className="cursor-pointer select-none text-zinc-400 hover:text-zinc-200">
                  Earlier: {old.version}, {old.title}
                </summary>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {old.items.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden>{item.emoji}</span>
                      <span className="text-zinc-300">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-6 py-4">
              <button
                type="button"
                onClick={close}
                autoFocus
                className="w-full rounded-xl bg-violet-600 py-3 font-bold text-white transition hover:bg-violet-500 active:scale-95"
              >
                Let&apos;s roll!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
