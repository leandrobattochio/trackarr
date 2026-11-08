import { describe, expect, it } from "vitest";
import { getRatioColor, isBelowRequiredRatio, isInfiniteRatio } from "@/features/integrations/ratio";

describe("ratio helpers", () => {
  it.each([
    [2.5, "text-success"],
    [2, "text-success"],
    [1.2, "text-primary"],
    [0.9, "text-warning"],
    [0.5, "text-destructive"],
  ])("colors a ratio of %s as %s", (ratio, color) => {
    expect(getRatioColor(ratio)).toBe(color);
  });

  it("is infinite only when there is no ratio and nothing was downloaded", () => {
    expect(isInfiniteRatio(null, 0)).toBe(true);
    expect(isInfiniteRatio(null, null)).toBe(false);
    expect(isInfiniteRatio(1.5, 0)).toBe(false);
  });

  it("is below the required ratio only when both are known and the ratio is lower", () => {
    expect(isBelowRequiredRatio(0.9, 1)).toBe(true);
    expect(isBelowRequiredRatio(1, 1)).toBe(false);
    expect(isBelowRequiredRatio(null, 1)).toBe(false);
    expect(isBelowRequiredRatio(0.5, null)).toBe(false);
  });
});
