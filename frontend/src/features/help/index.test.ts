import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/help/HelpPage", () => ({
  default: "HelpPageMock",
}));

describe("help index exports", () => {
  it("re-exports HelpPage", async () => {
    const module = await import("@/features/help");
    expect(module.HelpPage).toBe("HelpPageMock");
  });
});
