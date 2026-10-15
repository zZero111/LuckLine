"use server";

import { redirect } from "next/navigation";
import { getSiteOrigin } from "@/lib/supabase/origin";
import { createClient } from "@/lib/supabase/server";

export type FormState = { message: string | null; ok?: boolean };

const NEUTRAL_LOGIN_MESSAGE = "If that address can sign in, a link is on its way.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_RE = /^[A-Za-z0-9_.-]( ?[A-Za-z0-9_.-])*$/;
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{8,256}$/;

/** Same rule as the profiles.display_name check constraint. */
function isValidDisplayName(name: string) {
  return name.length >= 3 && name.length <= 24 && DISPLAY_NAME_RE.test(name);
}

export async function requestLoginLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { message: "Enter a valid email address." };
  }

  try {
    const supabase = await createClient();
    const origin = await getSiteOrigin();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: true },
    });
  } catch {
    // Deliberately ignored: the response never reveals whether sending worked.
  }
  return { message: NEUTRAL_LOGIN_MESSAGE, ok: true };
}

export async function confirmSignIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("token_hash");
  const tokenHash = typeof raw === "string" ? raw : "";
  const failed: FormState = { message: "Link expired or already used." };
  if (!TOKEN_HASH_RE.test(tokenHash)) return failed;

  let destination: "/" | "/welcome";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error || !data.user) return failed;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();
    destination = profile ? "/" : "/welcome";
  } catch {
    return failed;
  }
  redirect(destination);
}

export async function createProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = formData.get("display_name");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!isValidDisplayName(name)) {
    return {
      message:
        "Use 3-24 letters, numbers, _ . or -, with single spaces only between characters.",
    };
  }

  const { error } = await supabase.from("profiles").insert({ id: user.id, display_name: name });
  if (error) {
    if (error.code === "23505") {
      // Either the name is taken or this user already has a profile.
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (existing) redirect("/");
      return { message: "That name is taken." };
    }
    return { message: "Could not save that name. Please try again." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("confirm") !== "DELETE") {
    return { message: "Type DELETE to confirm." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return { message: "Could not delete your account. Please try again." };
  }
  // The auth user is gone; clear the local session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  redirect("/");
}
