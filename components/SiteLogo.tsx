"use client";

import Link from "next/link";
import { useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { SpinningDie } from "./SpinningDie";

/** Header logo: the die spins, speeds up on hover and rattles when clicked. */
export function SiteLogo() {
  const [hover, setHover] = useState(false);
  const [kick, setKick] = useState(0);
  return (
    <Link
      href="/"
      data-sfx="none"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => {
        sfx.rattle();
        setKick((k) => k + 1);
      }}
      className="flex items-center gap-2 text-xl font-extrabold tracking-tight"
    >
      <SpinningDie size={30} speed={40} fast={hover} kick={kick} />
      <span>
        <span className="text-violet-400">Luck</span>line
      </span>
    </Link>
  );
}

/** The big home-page title with a lively die. */
export function HeroLogo() {
  const [hover, setHover] = useState(false);
  const [kick, setKick] = useState(0);
  return (
    <h1
      className="flex cursor-pointer select-none items-center justify-center gap-3 text-4xl font-extrabold tracking-tight sm:text-5xl"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => {
        sfx.rattle();
        setKick((k) => k + 1);
      }}
      title="Give it a spin"
    >
      <SpinningDie size={56} speed={55} fast={hover} kick={kick} />
      <span>
        <span className="text-violet-400">Luck</span>line
      </span>
    </h1>
  );
}
