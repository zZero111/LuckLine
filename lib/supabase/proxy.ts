import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** Paths where a signed-out visitor is sent to /login (pages still check themselves). */
const SIGNED_IN_ONLY = ["/welcome", "/account", "/profile"];

function isSignedInOnly(pathname: string) {
  return SIGNED_IN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Standard @supabase/ssr session refresh for the proxy. Refreshes the auth
 * token cookies on every matched request. Makes no authorization decisions
 * beyond bouncing signed-out users off a few signed-in-only pages.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not run code between createServerClient and getUser(): it refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isSignedInOnly(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Carry over any cookie changes (e.g. a cleared, invalid session).
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
