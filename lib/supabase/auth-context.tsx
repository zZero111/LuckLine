"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthValue {
  status: Status;
  user: User | null;
  /** undefined while loading, null when the signed-in player has not picked a name yet. */
  displayName: string | null | undefined;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

type ProfileState = { userId: string; displayName: string | null };

async function fetchDisplayName(userId: string): Promise<string | null> {
  const { data } = await createClient()
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? null;
}

/**
 * Tracks who is signed in. This only decides what the page shows; Row Level
 * Security in the database is what actually protects the data.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: User | null } | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileState | null>(null);

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, next) => {
      setSession({ user: next?.user ?? null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchDisplayName(userId).then((displayName) => {
      if (!cancelled) setProfile({ userId, displayName });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const displayName = await fetchDisplayName(userId);
    setProfile({ userId, displayName });
  }, [userId]);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    const status: Status = session === undefined ? "loading" : user ? "signedIn" : "signedOut";
    const displayName = !user ? null : profile?.userId === user.id ? profile.displayName : undefined;
    return { status, user, displayName, refreshProfile };
  }, [session, profile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
