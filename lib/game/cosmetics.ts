// How each cosmetic looks. The database owns what exists, what it costs and who
// has it; this file only maps an item id to its visuals.

import { cosmeticAura, type AuraSpec, type AuraTheme } from "./auras";

export type CosmeticKind = "aura" | "frame" | "reveal" | "name";

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  price: number | null;
  unlock: string | null;
  sort: number;
}

export const KIND_LABEL: Record<CosmeticKind, string> = { aura: "Auras", frame: "Frames", reveal: "Reveals", name: "Names" };
export const KIND_SLOT: Record<CosmeticKind, "aura" | "frame" | "reveal" | "name"> = { aura: "aura", frame: "frame", reveal: "reveal", name: "name" };

const AURA_THEME: Record<string, Exclude<AuraTheme, null>> = {
  "aura-ember": "fire",
  "aura-void": "void",
  "aura-code": "code",
  "aura-storm": "electric",
  "aura-gold": "gold",
  "aura-starfall": "cosmic",
  "aura-beast": "fire",
};

/** Short tag under an aura's name in the shop. */
export const AURA_TAG: Record<string, string> = {
  "aura-ember": "FLAME",
  "aura-void": "VOID",
  "aura-code": "CODE",
  "aura-storm": "STORM",
  "aura-gold": "GOLD",
  "aura-starfall": "STARS",
  "aura-beast": "EVENT",
};

const AURA_COLOR: Record<string, string> = {
  "aura-ember": "#fb923c",
  "aura-void": "#a855f7",
  "aura-code": "#22c55e",
  "aura-storm": "#22d3ee",
  "aura-gold": "#facc15",
  "aura-starfall": "#818cf8",
  "aura-beast": "#ef4444",
};

const specCache = new Map<string, AuraSpec>();

/** The leaderboard aura for an item id, or null if it isn't an aura. */
export function auraSpec(id: string | null | undefined, strength = 0.8): AuraSpec | null {
  if (!id || !AURA_THEME[id]) return null;
  const key = `${id}|${strength}`;
  let spec = specCache.get(key);
  if (!spec) {
    spec = cosmeticAura(AURA_THEME[id], strength);
    specCache.set(key, spec);
  }
  return spec;
}

/** Accent colour for an item (its card border, preview glow). */
export function cosmeticColor(item: Pick<Cosmetic, "id" | "kind">): string {
  if (item.kind === "aura") return AURA_COLOR[item.id] ?? "#a78bfa";
  if (item.kind === "frame") return FRAME_COLOR[item.id] ?? "#a78bfa";
  if (item.kind === "reveal") return REVEAL_PALETTE[item.id]?.[0] ?? "#a78bfa";
  return NAME_COLOR[item.id] ?? "#a78bfa";
}

const FRAME_COLOR: Record<string, string> = {
  "frame-gold": "#fbbf24",
  "frame-neon": "#22d3ee",
  "frame-ice": "#7dd3fc",
  "frame-flame": "#fb923c",
  "frame-centurion": "#facc15",
  "frame-prism": "#e879f9",
};

const NAME_COLOR: Record<string, string> = {
  "name-gold": "#fbbf24",
  "name-prism": "#e879f9",
  "name-hunter": "#f59e0b",
  "name-neon": "#ec4899",
  "name-ice": "#38bdf8",
  "name-ember": "#f97316",
  "name-glitch": "#a3e635",
};

/** CSS class for a name style (defined in globals.css). */
export function nameClass(id: string | null | undefined): string {
  return id && NAME_COLOR[id] ? `lk-${id}` : "";
}

/** CSS class for an avatar frame (defined in globals.css). */
export function frameClass(id: string | null | undefined): string {
  return id && FRAME_COLOR[id] ? `lk-frame lk-${id}` : "";
}

/** Colours the roll stage cycles through while the digits land (never the real tier colour). */
export const DEFAULT_REVEAL_PALETTE = ["#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#fb923c", "#ef4444", "#22d3ee"];

export const REVEAL_PALETTE: Record<string, string[]> = {
  "reveal-neon": ["#ec4899", "#22d3ee", "#a855f7", "#f472b6", "#38bdf8", "#d946ef"],
  "reveal-sunset": ["#fb923c", "#f472b6", "#f59e0b", "#ef4444", "#fb7185", "#fbbf24"],
  "reveal-ocean": ["#0ea5e9", "#14b8a6", "#38bdf8", "#22d3ee", "#34d399", "#6366f1"],
  "reveal-mono": ["#e4e4e7", "#a1a1aa", "#f4f4f5", "#71717a", "#d4d4d8", "#fafafa"],
};

export function revealPalette(id: string | null | undefined): string[] {
  return (id && REVEAL_PALETTE[id]) || DEFAULT_REVEAL_PALETTE;
}
