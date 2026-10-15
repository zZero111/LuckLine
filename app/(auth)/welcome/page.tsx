import type { Metadata } from "next";
import { WelcomePanel } from "../forms";
import { AuthCard } from "../ui";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <AuthCard title="Pick a display name">
      <WelcomePanel />
    </AuthCard>
  );
}
