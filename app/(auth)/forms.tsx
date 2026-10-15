"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  confirmSignIn,
  createProfile,
  deleteAccount,
  requestLoginLink,
  type FormState,
} from "./actions";
import { buttonClass, inputClass } from "./ui";

const initial: FormState = { message: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(requestLoginLink, initial);
  return (
    <form action={action} className="space-y-3">
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
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state.message && (
        <p role="status" className={state.ok ? "text-sm text-violet-300" : "text-sm text-red-400"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ConfirmForm({ tokenHash }: { tokenHash: string }) {
  const [state, action, pending] = useActionState(confirmSignIn, initial);
  if (state.message) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
        <Link href="/login" className="text-sm text-violet-400 underline">
          Get a new link
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function WelcomeForm() {
  const [state, action, pending] = useActionState(createProfile, initial);
  return (
    <form action={action} className="space-y-3">
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

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  return (
    <form action={action} className="space-y-3">
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
