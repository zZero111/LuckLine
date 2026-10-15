import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserArea } from "@/components/UserArea";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luckline",
  description: "One roll a day. 0 to 1,000,000. Collect badges and climb the leaderboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-extrabold tracking-tight">
                <span className="text-violet-400">Luck</span>line
              </Link>
              <nav className="flex gap-4 text-sm text-zinc-400">
                <Link href="/" className="hover:text-zinc-100">
                  Play
                </Link>
                <Link href="/leaderboard" className="hover:text-zinc-100">
                  Leaderboard
                </Link>
                <Link href="/profile" className="hover:text-zinc-100">
                  Profile
                </Link>
              </nav>
            </div>
            <Suspense fallback={<span className="h-8 w-20 animate-pulse rounded-lg bg-zinc-800" />}>
              <UserArea />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
