import { describe, expect, it } from "vitest";

describe("settings types module", () => {
  it("loads the settings types module", async () => {
    const module = await import("@/features/settings/types");
    expect(module).toBeDefined();
  });
});
