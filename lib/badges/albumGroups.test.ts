import { describe, expect, it } from "vitest";
import { buildSections, familyTitle, fusionReward, MIN_FUSION_SIZE, type AlbumBadge } from "./albumGroups";

const b = (slug: string, family: string, ep: number): AlbumBadge => ({ slug, name: slug, emoji: "x", family, description: "", rarity: "common", ep });

describe("album sections", () => {
  it("makes a section per family of two or more, easiest first", () => {
    const secs = buildSections([b("c", "repeat", 50), b("a", "repeat", 2), b("d", "repeat", 5)]);
    expect(secs).toHaveLength(1);
    expect(secs[0].family).toBe("repeat");
    expect(secs[0].title).toBe("Repeating digits");
    expect(secs[0].badges.map((x) => x.slug)).toEqual(["a", "d", "c"]);
  });
  it("gathers single-badge families into themed collections", () => {
    const secs = buildSections([b("x", "meme-420", 250), b("y", "meme-69x", 20), b("z", "has-42", 20), b("p", "perfect", 250000)]);
    expect(secs.map((s) => s.title).sort()).toEqual(["Famous numbers", "Hidden patterns", "Number theory"]);
    expect(secs.every((s) => s.family === null)).toBe(true);
  });
  it("titles runs and counts by digit", () => {
    expect(familyTitle("run-5")).toBe("Runs of fives");
    expect(familyTitle("count-0")).toBe("Lots of zeros");
    expect(familyTitle("some-new-family")).toBe("Some new family");
  });
  it("fusion needs three badges", () => {
    expect(MIN_FUSION_SIZE).toBe(3);
  });
  it("fusion rewards match the database formula", () => {
    expect(fusionReward(3)).toBe(3500);
    expect(fusionReward(6)).toBe(5000);
    expect(fusionReward(74)).toBe(25000);
  });
});
