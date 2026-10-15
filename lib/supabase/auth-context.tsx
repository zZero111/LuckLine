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
  /** Storage path of the player's profile picture, if any. */
  avatarPath: string | null;
  /** True when an admin removed the player's picture; uploads are blocked. */
  avatarLocked: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

type ProfileFields = { displayName: string | null; avatarPath: string | null; avatarLocked: boolean };
type ProfileState = { userId: string } & ProfileFields;

async function fetchProfile(userId: string): Promise<ProfileFields> {
  const { data } = await createClient()
    .from("profiles")
    .select("display_name, avatar_path, avatar_locked")
    .eq("id", userId)
    .maybeSingle();
  return {
    displayName: data?.display_name ?? null,
    avatarPath: data?.avatar_path ?? null,
    avatarLocked: data?.avatar_locked ?? false,
  };
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
    fetchProfile(userId).then((fields) => {
      if (!cancelled) setProfile({ userId, ...fields });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const fields = await fetchProfile(userId);
    setProfile({ userId, ...fields });
  }, [userId]);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    const status: Status = session === undefined ? "loading" : user ? "signedIn" : "signedOut";
    const mine = user && profile?.userId === user.id ? profile : null;
    const displayName = !user ? null : mine ? mine.displayName : undefined;
    return {
      status,
      user,
      displayName,
      avatarPath: mine?.avatarPath ?? null,
      avatarLocked: mine?.avatarLocked ?? false,
      refreshProfile,
    };
  }, [session, profile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
