import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmForm } from "../../forms";
import { AuthCard, Loading } from "../../ui";

export const metadata: Metadata = { title: "Confirm sign-in" };

// The link is never verified on GET: email scanners prefetch links, which would
// use up the single-use token. Verification only happens on the POST below.
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <AuthCard title="Finish signing in">
      <Suspense fallback={<Loading />}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Confirm({
  searchParams,
}: {
  searchParams: PageProps<"/auth/confirm">["searchParams"];
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "email";

  if (!tokenHash || type !== "email") {
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

  return (
    <>
      <p className="mb-4 text-sm text-zinc-400">Press the button to sign in on this device.</p>
      <ConfirmForm tokenHash={tokenHash} />
    </>
  );
}
