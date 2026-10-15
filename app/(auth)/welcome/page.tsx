import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "../forms";
import { AuthCard, Loading } from "../ui";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <AuthCard title="Pick a display name">
      <Suspense fallback={<Loading />}>
        <Welcome />
      </Suspense>
    </AuthCard>
  );
}

async function Welcome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect("/");

  return (
    <>
      <p className="mb-4 text-sm text-zinc-400">This is how you appear on the leaderboard.</p>
      <WelcomeForm />
    </>
  );
}
