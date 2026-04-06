import { describe, expect, it } from "vitest";

describe("snapshots types module", () => {
  it("loads the snapshots types module", async () => {
    const module = await import("@/features/snapshots/types");
    expect(module).toBeDefined();
  });
});
