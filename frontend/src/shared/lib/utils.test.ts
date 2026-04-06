import { describe, expect, it } from "vitest";
import { cn } from "@/shared/lib/utils";

describe("cn", () => {
  it("merges truthy class values", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });

  it("merges tailwind conflicts using tailwind-merge", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });
});
