import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/DashboardPage", () => ({ default: "DashboardPageMock" }));
vi.mock("@/features/plugins/ManagePluginsPage", () => ({ default: "ManagePluginsPageMock" }));
vi.mock("@/features/settings/SettingsPage", () => ({ default: "SettingsPageMock" }));
vi.mock("@/features/snapshots/SnapshotsPage", () => ({ default: "SnapshotsPageMock" }));
vi.mock("@/shared/hooks/use-mobile", () => ({ useIsMobile: "useIsMobileMock" }));
vi.mock("@/shared/hooks/use-toast", () => ({
  useToast: "useToastMock",
  toast: "toastMock",
  reducer: "reducerMock",
}));
vi.mock("@/shared/lib/utils", () => ({ cn: "cnMock" }));

describe("entrypoint barrels", () => {
  it("re-exports feature pages", async () => {
    const integrations = await import("@/features/integrations");
    const plugins = await import("@/features/plugins");
    const settings = await import("@/features/settings");
    const snapshots = await import("@/features/snapshots");

    expect(integrations.DashboardPage).toBe("DashboardPageMock");
    expect(plugins.ManagePluginsPage).toBe("ManagePluginsPageMock");
    expect(settings.SettingsPage).toBe("SettingsPageMock");
    expect(snapshots.SnapshotsPage).toBe("SnapshotsPageMock");
  });

  it("re-exports shared hook and lib entrypoints", async () => {
    const mobile = await import("@/hooks/use-mobile");
    const toast = await import("@/hooks/use-toast");
    const utils = await import("@/lib/utils");

    expect(mobile.useIsMobile).toBe("useIsMobileMock");
    expect(toast.useToast).toBe("useToastMock");
    expect(toast.toast).toBe("toastMock");
    expect(toast.reducer).toBe("reducerMock");
    expect(utils.cn).toBe("cnMock");
  });
});
