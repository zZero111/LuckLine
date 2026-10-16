import { Countdown } from "@/components/Countdown";
import { HeroLogo } from "@/components/SiteLogo";
import { Play } from "@/components/Play";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <div>
        <HeroLogo />
        <p className="mt-3 text-zinc-400">One roll a day. 0 to 1,000,000. Collect badges.</p>
      </div>
      <Play />
      <Countdown />
    </div>
  );
}
