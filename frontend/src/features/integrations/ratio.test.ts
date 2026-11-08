import { describe, expect, it } from "vitest";
import { getRatioColor, isBelowRequiredRatio } from "@/features/integrations/ratio";

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

  it("is below the required ratio only when both are known and the ratio is lower", () => {
    expect(isBelowRequiredRatio(0.9, 1)).toBe(true);
    expect(isBelowRequiredRatio(1, 1)).toBe(false);
    expect(isBelowRequiredRatio(null, 1)).toBe(false);
    expect(isBelowRequiredRatio(0.5, null)).toBe(false);
  });
});
