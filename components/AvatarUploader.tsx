"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AVATAR_BUCKET, resizeForAvatar } from "@/lib/avatars";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";

/** Upload, replace or remove your own profile picture. */
export function AvatarUploader() {
  const { user, displayName, avatarPath, avatarLocked, refreshProfile } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  if (!user) return null;
  const uid = user.id;

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const { blob, ext } = await resizeForAvatar(file);
      const supabase = createClient();
      const path = `${uid}/avatar-${Date.now().toString(36)}.${ext}`;
      const up = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
      if (up.error) throw new Error("Upload failed. Please try again.");
      const set = await supabase.from("profiles").update({ avatar_path: path }).eq("id", uid);
      if (set.error) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path]);
        throw new Error("Couldn't save your picture. Please try again.");
      }
      if (avatarPath) await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
      await refreshProfile();
      setMessage({ text: "Picture updated." });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Something went wrong.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!avatarPath) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const set = await supabase.from("profiles").update({ avatar_path: null }).eq("id", uid);
    if (!set.error) await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    await refreshProfile();
    setBusy(false);
    setMessage(set.error ? { text: "Couldn't remove your picture.", error: true } : { text: "Picture removed." });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar path={avatarPath} name={displayName} size={72} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {avatarLocked ? (
          <p className="text-sm text-amber-300">Your picture was removed by an admin, so uploads are turned off.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? "Working…" : avatarPath ? "Change picture" : "Upload picture"}
            </button>
            {avatarPath && (
              <button
                type="button"
                disabled={busy}
                onClick={onRemove}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPick} />
          </div>
        )}
        <p className="text-xs text-zinc-500">PNG, JPEG or WebP, up to 5 MB. It&apos;s cropped to a square and shown to other players.</p>
        {message && (
          <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-rose-300" : "text-emerald-300"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
