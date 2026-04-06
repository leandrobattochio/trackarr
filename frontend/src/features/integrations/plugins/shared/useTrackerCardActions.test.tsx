import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const successToast = vi.fn();
const errorToast = vi.fn();
const syncMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => successToast(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

vi.mock("@/features/integrations/hooks", () => ({
  useSyncIntegration: () => ({ mutate: syncMutate, isPending: false }),
  useDeleteIntegration: () => ({ mutate: deleteMutate, isPending: false }),
}));

import { useTrackerCardActions } from "@/features/integrations/plugins/shared/useTrackerCardActions";
import type { TrackerIntegration } from "@/features/integrations/types";

const tracker: TrackerIntegration = {
  id: "tracker-1",
  pluginId: "seedpool",
  dashboard: { metrics: [] },
  byteUnitSystem: "binary",
  name: "Seedpool",
  payload: {},
  url: null,
  ratio: 1.5,
  uploaded: 1,
  downloaded: 1,
  seedBonus: null,
  buffer: null,
  hitAndRuns: null,
  requiredRatio: 1,
  seedingTorrents: null,
  leechingTorrents: null,
  activeTorrents: null,
  lastSync: null,
  lastSyncExact: null,
  nextAutomaticSync: null,
  nextAutomaticSyncExact: null,
  status: "success",
  statusLabel: "success",
  configurationValid: true,
  configurationError: null,
};

describe("useTrackerCardActions", () => {
  it("handles sync success/auth/unknown and network error branches", () => {
    syncMutate.mockImplementation((_id: string, options: unknown) => {
      options.onSuccess({ lastSyncResult: "success" });
      options.onSuccess({ lastSyncResult: "authFailed" });
      options.onSuccess({ lastSyncResult: "unknownError" });
      options.onError(new Error("offline"));
    });

    const { result } = renderHook(() => useTrackerCardActions(tracker));
    result.current.handleSync();

    expect(syncMutate).toHaveBeenCalled();
    expect(successToast).toHaveBeenCalledWith("Seedpool synced successfully");
    expect(errorToast).toHaveBeenCalledWith("Seedpool sync failed: authentication failed");
    expect(errorToast).toHaveBeenCalledWith("Seedpool sync failed: unknown error");
    expect(errorToast).toHaveBeenCalledWith("Sync failed: offline");
  });

  it("handles delete success and error branches", () => {
    deleteMutate.mockImplementation((_id: string, options: unknown) => {
      options.onSuccess();
      options.onError(new Error("forbidden"));
    });

    const { result } = renderHook(() => useTrackerCardActions(tracker));
    result.current.handleDelete();

    expect(deleteMutate).toHaveBeenCalledWith("tracker-1", expect.unknown(Object));
    expect(successToast).toHaveBeenCalledWith("Seedpool removed");
    expect(errorToast).toHaveBeenCalledWith("Delete failed: forbidden");
    expect(result.current.actionsDisabled).toBe(false);
  });
});

