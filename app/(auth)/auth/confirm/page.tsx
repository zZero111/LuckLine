import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmPanel } from "../../forms";
import { AuthCard, Loading } from "../../ui";

export const metadata: Metadata = { title: "Confirm sign-in" };

export default function ConfirmPage() {
  return (
    <AuthCard title="Finish signing in">
      <Suspense fallback={<Loading />}>
        <ConfirmPanel />
      </Suspense>
    </AuthCard>
  );
}
