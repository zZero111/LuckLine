"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { sfx } from "@/lib/game/sfx";

const CONTROL = 'button, [role="switch"], summary, label[for], input[type="file"], input[type="range"]';

/**
 * Site-wide interaction sounds. Buttons click, page changes whoosh.
 * A control can opt out or pick another sound with data-sfx="none|coin|rattle|success".
 */
export function UiFx() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    sfx.nav();
  }, [pathname]);

  useEffect(() => {
    const play = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest?.(CONTROL) as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      switch (el.dataset.sfx) {
        case "none":
          return;
        case "coin":
          return sfx.coin();
        case "rattle":
          return sfx.rattle();
        case "success":
          return sfx.success();
        default:
          return sfx.click();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) play(e.target);
    };
    // Keyboard presses (Enter/Space) arrive as clicks with detail 0.
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) play(e.target);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
