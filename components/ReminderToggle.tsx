"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";

/** Account-page switch for the daily "your roll is waiting" email. */
export function ReminderToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    createClient()
      .from("reminder_prefs")
      .select("enabled")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEnabled(data?.enabled ?? true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function toggle() {
    if (!uid || enabled === null) return;
    const next = !enabled;
    setSaving(true);
    setError(false);
    const { error: e } = await createClient().from("reminder_prefs").update({ enabled: next }).eq("user_id", uid);
    setSaving(false);
    if (e) {
      setError(true);
      sfx.error();
    } else {
      setEnabled(next);
      sfx.toggle(next);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-200">Daily reminder email</p>
        <p className="text-xs text-zinc-500">
          One email in the evening (UTC) if you haven&apos;t rolled yet. Only sent while you&apos;re playing.
        </p>
        {error && <p className="text-xs text-rose-300">Couldn&apos;t save. Please try again.</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!enabled}
        aria-label="Daily reminder email"
        disabled={enabled === null || saving}
        onClick={toggle}
        data-sfx="none"
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${enabled ? "bg-violet-600" : "bg-zinc-700"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}
