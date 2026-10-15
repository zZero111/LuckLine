import type { Metadata } from "next";
import { AccountPanel } from "../forms";
import { AuthCard } from "../ui";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <AuthCard title="Your account">
      <AccountPanel />
    </AuthCard>
  );
}
