import "server-only";

import { headers } from "next/headers";

const DEV_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"];

function normalize(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Origin for links sent by email. Only ever one of an allow-listed set:
 * NEXT_PUBLIC_SITE_URL, http://127.0.0.1:3000 or http://localhost:3000.
 * The request host is used only to pick between those; arbitrary Host or
 * Origin headers are never trusted.
 */
export async function getSiteOrigin(): Promise<string> {
  const siteUrl = normalize(process.env.NEXT_PUBLIC_SITE_URL);
  const allowed = new Set<string>(DEV_ORIGINS);
  if (siteUrl) allowed.add(siteUrl);

  const h = await headers();
  const host = h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") === "https" ? "https" : "http";
    const candidate = normalize(`${proto}://${host}`);
    if (candidate && allowed.has(candidate)) return candidate;
  }

  return siteUrl ?? DEV_ORIGINS[0];
}
