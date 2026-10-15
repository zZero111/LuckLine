import type { Metadata } from "next";
import Link from "next/link";
import { UserArea } from "@/components/UserArea";
import { AuthProvider } from "@/lib/supabase/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luckline",
  description: "One roll a day. 0 to 1,000,000. Collect badges and climb the leaderboard.",
};

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// GitHub Pages cannot send HTTP headers, so the policy rides in a <meta> tag.
// Inline scripts are needed for Next's hydration payload. frame-ancestors,
// X-Frame-Options and HSTS cannot be set this way and are not applied.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(supabaseUrl.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <AuthProvider>
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
              <UserArea />
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
