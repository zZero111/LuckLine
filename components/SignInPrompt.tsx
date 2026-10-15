import Link from "next/link";

export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
      <p className="text-zinc-300">{message}</p>
      <Link href="/login" className="rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">
        Sign in
      </Link>
    </div>
  );
}
