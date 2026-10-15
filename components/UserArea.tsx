import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/** Header user area. Reads cookies, so render inside <Suspense>. */
export async function UserArea() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link href="/login" className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
        Sign in
      </Link>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="flex items-center gap-3 text-sm">
      {profile ? (
        <span className="max-w-[10rem] truncate text-zinc-300">{profile.display_name}</span>
      ) : (
        <Link href="/welcome" className="text-violet-300 hover:text-violet-200">
          Choose a name
        </Link>
      )}
      <Link href="/account" className="text-zinc-400 hover:text-zinc-100">
        Account
      </Link>
    </div>
  );
}
