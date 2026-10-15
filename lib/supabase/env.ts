// Only the project URL and the publishable key are ever used by the app.
// A secret key (sb_secret_...) must never be read here or put in NEXT_PUBLIC_*.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_secret_")) {
  throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key, not a secret key");
}
