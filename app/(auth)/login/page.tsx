import type { Metadata } from "next";
import { LoginForm } from "../forms";
import { AuthCard } from "../ui";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in to Luckline">
      <p className="mb-4 text-sm text-zinc-400">
        Enter your email and we will send you a one-time sign-in link. No password needed.
      </p>
      <LoginForm />
    </AuthCard>
  );
}
