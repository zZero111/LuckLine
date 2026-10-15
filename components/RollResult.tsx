"use client";

import { useState } from "react";
import { sfx } from "@/lib/game/sfx";
import { Reveal } from "./Reveal";
import type { RollResultData } from "./types";

/** Today's finished result, with a button to watch the reveal again. */
export function RollResult({
  result,
  newSlugs,
  streak,
}: {
  result: RollResultData;
  newSlugs?: ReadonlySet<string>;
  streak?: number;
}) {
  const [replay, setReplay] = useState(0);
  return (
    <Reveal
      key={replay}
      result={result}
      animate={replay > 0}
      newSlugs={newSlugs}
      streak={streak}
      onReplay={() => {
        sfx.unlock();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setReplay((r) => r + 1);
      }}
    />
  );
}
