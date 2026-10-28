import { nameClass } from "@/lib/game/cosmetics";

/** A display name, with the player's equipped name style (if any). Always rendered as plain text. */
export function PlayerName({ name, style, className = "" }: { name: string | null | undefined; style?: string | null; className?: string }) {
  const cls = nameClass(style);
  return <span className={`${cls} ${className}`.trim()}>{name}</span>;
}
