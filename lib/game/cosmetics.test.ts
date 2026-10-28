import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AURA_TAG, auraSpec, cosmeticColor, frameClass, nameClass, revealPalette, type CosmeticKind } from "./cosmetics";

const migration = readFileSync("supabase/migrations/20261101120000_credits_and_cosmetics.sql", "utf8");
const events = readFileSync("supabase/migrations/20261101130000_engagement_features.sql", "utf8");
const seed = readFileSync("supabase/seed.sql", "utf8");

/** [id, kind] for every cosmetic the database seeds. */
const items = [...migration.matchAll(/^\s*\('([a-z0-9-]+)',\s*'(aura|frame|reveal|name)'/gm)].map((m) => [m[1], m[2] as CosmeticKind] as const);

describe("cosmetics", () => {
  it("reads the seeded catalogue", () => {
    expect(items.length).toBeGreaterThanOrEqual(20);
  });
  it("has a look for every seeded item", () => {
    for (const [id, kind] of items) {
      if (kind === "aura") expect(auraSpec(id), id).not.toBeNull();
      if (kind === "aura") expect(AURA_TAG[id], id).toBeTruthy();
      if (kind === "frame") expect(frameClass(id), id).toContain("lk-frame");
      if (kind === "name") expect(nameClass(id), id).toBe(`lk-${id}`);
      if (kind === "reveal") expect(revealPalette(id).length, id).toBeGreaterThan(3);
      expect(cosmeticColor({ id, kind }), id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("has CSS for every frame and name style", () => {
    const css = readFileSync("app/globals.css", "utf8");
    for (const [id, kind] of items) {
      if (kind === "frame" || kind === "name") expect(css, id).toContain(`.lk-${id}`);
    }
  });
});

describe("event and reward data", () => {
  it("only boosts badges that exist in the catalogue", () => {
    const slugs = new Set([...seed.matchAll(/'([a-z0-9-]{1,40})'/g)].map((m) => m[1]));
    const boosted = [...events.matchAll(/array\[([^\]]+)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]));
    expect(boosted.length).toBeGreaterThanOrEqual(18);
    for (const slug of boosted) expect(slugs.has(slug), slug).toBe(true);
  });
  it("only rewards cosmetics that exist", () => {
    const ids = new Set(items.map(([id]) => id));
    const used = [...events.matchAll(/'((?:aura|frame|name|reveal)-[a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(5);
    for (const id of used) expect(ids.has(id), id).toBe(true);
  });
});
