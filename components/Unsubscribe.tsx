"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One-click unsubscribe from the link in a reminder email. No sign-in needed. */
export function Unsubscribe() {
  const token = useSearchParams().get("token") ?? "";
  const valid = UUID.test(token);
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    createClient()
      .rpc("unsubscribe_reminders", { unsubscribe_token: token })
      .then(({ data, error }) => {
        if (!cancelled) setState(!error && data ? "done" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token, valid]);

  if (!valid || state === "failed") {
    return (
      <p className="text-zinc-300">
        That unsubscribe link isn&apos;t valid. You can turn reminders off on your{" "}
        <Link href="/account" className="text-violet-300 underline">
          Account page
        </Link>
        .
      </p>
    );
  }
  if (state === "working") return <p className="text-zinc-400">Turning off reminders…</p>;
  return (
    <>
      <p className="text-lg text-zinc-200">Done. You won&apos;t get daily reminder emails any more.</p>
      <p className="text-sm text-zinc-500">
        Changed your mind? Turn them back on from your{" "}
        <Link href="/account" className="text-violet-300 underline">
          Account page
        </Link>
        .
      </p>
    </>
  );
}
