import { Countdown } from "@/components/Countdown";
import { DiceLogo } from "@/components/DiceLogo";
import { Play } from "@/components/Play";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <div>
        <h1 className="flex items-center justify-center gap-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          <DiceLogo size={52} className="lk-logo-wobble" />
          <span>
            <span className="text-violet-400">Luck</span>line
          </span>
        </h1>
        <p className="mt-3 text-zinc-400">One roll a day. 0 to 1,000,000. Collect badges.</p>
      </div>
      <Play />
      <Countdown />
    </div>
  );
}
