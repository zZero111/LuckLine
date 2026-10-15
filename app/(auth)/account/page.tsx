import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";
import { DeleteAccountForm } from "../forms";
import { AuthCard, Loading, buttonClass } from "../ui";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <AuthCard title="Your account">
      <Suspense fallback={<Loading />}>
        <Account />
      </Suspense>
    </AuthCard>
  );
}

async function Account() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-zinc-400">Email</dt>
          <dd className="break-all">{user.email ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Display name</dt>
          <dd>
            {profile ? (
              profile.display_name
            ) : (
              <Link href="/welcome" className="text-violet-400 underline">
                Choose a display name
              </Link>
            )}
          </dd>
        </div>
      </dl>

      <form action={signOut}>
        <button type="submit" className={buttonClass}>
          Sign out
        </button>
      </form>

      <section className="border-t border-zinc-800 pt-4">
        <h2 className="mb-2 text-sm font-semibold text-red-300">Danger zone</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
