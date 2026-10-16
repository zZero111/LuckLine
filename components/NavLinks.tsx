"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Play" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/badges", label: "Badges" },
  { href: "/profile", label: "Profile" },
];

function isActive(href: string, pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

/** Main navigation with an underline that slides to the current page. */
export function NavLinks() {
  const pathname = usePathname();
  const box = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const activeHref = LINKS.find((l) => isActive(l.href, pathname))?.href ?? null;

  useLayoutEffect(() => {
    const measure = () => {
      const target = activeHref ? box.current?.querySelector<HTMLElement>(`[data-href="${activeHref}"]`) : null;
      setBar(target ? { left: target.offsetLeft, width: target.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [activeHref]);

  return (
    <nav ref={box} className="relative flex gap-1 pb-1 text-sm" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.href === activeHref;
        return (
          <Link
            key={l.href}
            href={l.href}
            data-href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 transition-colors duration-200 ${
              active ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-[left,width,opacity] duration-300 ease-out"
        style={{ left: bar?.left ?? 0, width: bar?.width ?? 0, opacity: bar ? 1 : 0 }}
      />
    </nav>
  );
}
