import type { Metadata } from "next";
import { NavLinks } from "@/components/NavLinks";
import { SiteLogo } from "@/components/SiteLogo";
import { SoundToggle } from "@/components/SoundToggle";
import { UiFx } from "@/components/UiFx";
import { UserArea } from "@/components/UserArea";
import { WhatsNew } from "@/components/WhatsNew";
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
  `img-src 'self' data: blob: ${supabaseUrl}`.trim(),
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
          <UiFx />
          <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <SiteLogo />
                <NavLinks />
              </div>
              <div className="flex items-center gap-3">
                <SoundToggle compact />
                <UserArea />
              </div>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10">{children}</main>
          <footer className="mx-auto w-full max-w-4xl px-4 pb-6 text-center">
            <WhatsNew />
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
