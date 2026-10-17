"use client";

import { AvatarUploader } from "@/components/AvatarUploader";
import { ReminderToggle } from "@/components/ReminderToggle";
import { AVATAR_BUCKET } from "@/lib/avatars";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { buttonClass, inputClass, Loading } from "./ui";

type FormState = { message: string | null; ok?: boolean };

const initial: FormState = { message: null };
const NEUTRAL_LOGIN_MESSAGE = "If that address can sign in, a link is on its way.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_RE = /^[A-Za-z0-9_.-]( ?[A-Za-z0-9_.-])*$/;
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{8,256}$/;

/** Same rule as the profiles.display_name check constraint. */
function isValidDisplayName(name: string) {
  return name.length >= 3 && name.length <= 24 && DISPLAY_NAME_RE.test(name);
}

function formString(form: HTMLFormElement, field: string) {
  const raw = new FormData(form).get(field);
  return typeof raw === "string" ? raw.trim() : "";
}

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt ignores anything longer

type LoginMode = "password" | "link" | "forgot";

/** Sends a signed-in player to the game, or to name picking if they have no profile yet. */
async function goAfterSignIn(router: ReturnType<typeof useRouter>, userId: string) {
  const { data: profile } = await createClient().from("profiles").select("id").eq("id", userId).maybeSingle();
  router.replace(profile ? "/" : "/welcome");
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [state, setState] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);

  function switchMode(next: LoginMode) {
    setMode(next);
    setState(initial);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = formString(form, "email");
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      setState({ message: "Enter a valid email address." });
      return;
    }

    if (mode === "password") {
      const password = new FormData(form).get("password");
      if (typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD) {
        setState({ message: "Enter your password." });
        return;
      }
      setPending(true);
      try {
        const { data, error } = await createClient().auth.signInWithPassword({ email, password });
        if (!error && data.user) {
          await goAfterSignIn(router, data.user.id);
          return;
        }
      } catch {
        // Falls through to the same message as a wrong password.
      }
      setPending(false);
      // One message for every failure, so it never reveals which emails have accounts.
      setState({ message: "Wrong email or password. First time, or no password set yet? Use the email link." });
      return;
    }

    setPending(true);
    try {
      if (mode === "link") {
        await createClient().auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}${BASE_PATH}/auth/confirm/`,
            shouldCreateUser: true,
          },
        });
      } else {
        await createClient().auth.resetPasswordForEmail(email);
      }
    } catch {
      // Deliberately ignored: the response never reveals whether sending worked.
    }
    setPending(false);
    setState({
      message: mode === "link" ? NEUTRAL_LOGIN_MESSAGE : "If that address has an account, a reset link is on its way.",
      ok: true,
    });
  }

  const tab = (m: LoginMode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {mode !== "forgot" && (
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {tab("password", "Password")}
          {tab("link", "Email link")}
        </div>
      )}
      <p className="text-sm text-zinc-400">
        {mode === "password" && "Sign in with your email and password."}
        {mode === "link" && "We'll email you a one-time sign-in link. Use this the first time, then set a password in your account."}
        {mode === "forgot" && "Enter your email and we'll send you a link to set a new password."}
      </p>
      <label htmlFor="email" className="block text-sm text-zinc-300">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="you@example.com"
        className={inputClass}
      />
      {mode === "password" && (
        <>
          <label htmlFor="password" className="block text-sm text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            maxLength={MAX_PASSWORD}
            autoComplete="current-password"
            className={inputClass}
          />
        </>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending
          ? mode === "password"
            ? "Signing in…"
            : "Sending…"
          : mode === "password"
            ? "Sign in"
            : mode === "link"
              ? "Email me a sign-in link"
              : "Email me a reset link"}
      </button>
      {state.message && (
        <p role="status" className={state.ok ? "text-sm text-violet-300" : "text-sm text-red-400"}>
          {state.message}
        </p>
      )}
      {mode === "password" && (
        <button type="button" onClick={() => switchMode("forgot")} className="text-sm text-zinc-400 underline underline-offset-4 hover:text-white">
          Forgot your password?
        </button>
      )}
      {mode === "forgot" && (
        <button type="button" onClick={() => switchMode("password")} className="text-sm text-zinc-400 underline underline-offset-4 hover:text-white">
          Back to sign in
        </button>
      )}
    </form>
  );
}

function ExpiredLink() {
  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-red-400">
        Link expired or already used.
      </p>
      <Link href="/login" className="text-sm text-violet-400 underline">
        Get a new link
      </Link>
    </div>
  );
}

// The link is never verified just by opening the page: email scanners open
// links, which would use up the single-use token. Verification only happens
// when the player presses the button.
export function ConfirmPanel() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash") ?? "";
  const type = params.get("type") ?? "email";

  if (!TOKEN_HASH_RE.test(tokenHash) || (type !== "email" && type !== "recovery")) return <ExpiredLink />;

  return (
    <>
      <p className="mb-4 text-sm text-zinc-400">
        {type === "recovery" ? "Press the button, then choose a new password." : "Press the button to sign in on this device."}
      </p>
      <ConfirmForm tokenHash={tokenHash} type={type} />
    </>
  );
}

function ConfirmForm({ tokenHash, type }: { tokenHash: string; type: "email" | "recovery" }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error || !data.user) {
        setFailed(true);
        setPending(false);
        return;
      }
      if (type === "recovery") {
        router.replace("/account#password");
        return;
      }
      await goAfterSignIn(router, data.user.id);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  if (failed) return <ExpiredLink />;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : type === "recovery" ? "Continue" : "Sign in"}
      </button>
    </form>
  );
}

export function WelcomePanel() {
  const router = useRouter();
  const { status, displayName } = useAuth();

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
    else if (typeof displayName === "string") router.replace("/");
  }, [status, displayName, router]);

  if (status !== "signedIn" || displayName !== null) return <Loading />;

  return (
    <>
      <p className="mb-4 text-sm text-zinc-400">This is how you appear on the leaderboard.</p>
      <WelcomeForm />
    </>
  );
}

function WelcomeForm() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const name = formString(event.currentTarget, "display_name");
    if (!isValidDisplayName(name)) {
      setState({
        message: "Use 3-24 letters, numbers, _ . or -, with single spaces only between characters.",
      });
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").insert({ id: user.id, display_name: name });
    if (error) {
      if (error.code === "23505") {
        // Either the name is taken or this player already has a profile.
        const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
        if (existing) {
          await refreshProfile();
          router.replace("/");
          return;
        }
        setState({ message: "That name is taken." });
      } else {
        setState({ message: "Could not save that name. Please try again." });
      }
      setPending(false);
      return;
    }
    await refreshProfile();
    router.replace("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="display_name" className="block text-sm text-zinc-300">
        Display name
      </label>
      <input
        id="display_name"
        name="display_name"
        required
        minLength={3}
        maxLength={24}
        pattern="[A-Za-z0-9_.\-]( ?[A-Za-z0-9_.\-])*"
        autoComplete="nickname"
        className={inputClass}
      />
      <p className="text-xs text-zinc-500">3-24 characters: letters, numbers, _ . - and single spaces.</p>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save name"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function AccountPanel() {
  const router = useRouter();
  const { status, user, displayName } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  async function onSignOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/");
  }

  if (status !== "signedIn" || !user) return <Loading />;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Profile picture</h2>
        <AvatarUploader />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Emails</h2>
        <ReminderToggle />
      </section>

      <section id="password">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Password</h2>
        <PasswordForm />
      </section>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-zinc-400">Email</dt>
          <dd className="break-all">{user.email ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Display name</dt>
          <dd>
            {displayName ? (
              displayName
            ) : displayName === null ? (
              <Link href="/welcome" className="text-violet-400 underline">
                Choose a display name
              </Link>
            ) : (
              "…"
            )}
          </dd>
        </div>
      </dl>

      <button type="button" onClick={onSignOut} disabled={signingOut} className={buttonClass}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>

      <section className="border-t border-zinc-800 pt-4">
        <h2 className="mb-2 text-sm font-semibold text-red-300">Danger zone</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}

function PasswordForm() {
  const [state, setState] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = data.get("password");
    const again = data.get("again");
    if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      setState({ message: `Use ${MIN_PASSWORD}-${MAX_PASSWORD} characters.` });
      return;
    }
    if (password !== again) {
      setState({ message: "The two passwords don't match." });
      return;
    }
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) {
      setState({ message: "Could not save that password. Try a longer or less common one, or sign in again first." });
      return;
    }
    form.reset();
    setState({ message: "Password saved. Next time you can sign in with your email and password.", ok: true });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-zinc-500">Set or change the password you sign in with. {MIN_PASSWORD} characters or more.</p>
      <label htmlFor="new-password" className="sr-only">
        New password
      </label>
      <input id="new-password" name="password" type="password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="New password" className={inputClass} />
      <label htmlFor="new-password-again" className="sr-only">
        Repeat new password
      </label>
      <input id="new-password-again" name="again" type="password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="Repeat new password" className={inputClass} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save password"}
      </button>
      {state.message && (
        <p role="status" className={state.ok ? "text-sm text-violet-300" : "text-sm text-red-400"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function DeleteAccountForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formString(event.currentTarget, "confirm") !== "DELETE") {
      setState({ message: "Type DELETE to confirm." });
      return;
    }
    setPending(true);
    const supabase = createClient();
    // Remove the player's pictures first: Storage files aren't deleted with the account.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(user.id);
      if (files?.length) await supabase.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setState({ message: "Could not delete your account. Please try again." });
      setPending(false);
      return;
    }
    // The auth user is gone; clear the local session.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    router.replace("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="confirm" className="block text-sm text-zinc-300">
        Type <span className="font-mono text-white">DELETE</span> to permanently delete your account
        and all your rolls.
      </label>
      <input id="confirm" name="confirm" autoComplete="off" className={inputClass} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-red-700 px-4 py-2 font-medium text-red-300 hover:bg-red-950 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete account"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
