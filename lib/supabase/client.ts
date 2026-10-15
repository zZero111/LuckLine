"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let client: ReturnType<typeof createSupabaseClient<Database>> | undefined;

/**
 * The one Supabase client for the whole app. It runs only in the browser and
 * uses the publishable key, so every request is checked by Row Level Security
 * as the signed-in player. The session is kept in this browser's localStorage
 * under its own key. Call it from event handlers and effects, never during render.
 */
export function createClient() {
  client ??= createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "luckline-auth",
    },
  });
  return client;
}
