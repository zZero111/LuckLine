import type { Metadata } from "next";
import { LoginForm } from "../forms";
import { AuthCard } from "../ui";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in to Luckline">
      <LoginForm />
    </AuthCard>
  );
}
