import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/DashboardPage", () => ({
  default: "DashboardPageMock",
}));

describe("integrations index exports", () => {
  it("re-exports DashboardPage", async () => {
    const module = await import("@/features/integrations");
    expect(module.DashboardPage).toBe("DashboardPageMock");
  });
});
