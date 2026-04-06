import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { snapshotsApi } from "@/features/snapshots/api";
import { useSnapshotFilters, useSnapshots } from "@/features/snapshots/hooks";

function toLocalDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function createWrapper(initialEntry = "/snapshots?integrationId=integration-1&range=1h") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSnapshotFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-applies preset range changes", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleRangeChange("15m");
    });

    expect(result.current.range).toBe("15m");
    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-1",
      range: "15m",
      from: undefined,
      to: undefined,
    });
  });

  it("auto-applies integration changes when the current filters are valid", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleIntegrationChange("integration-2");
    });

    expect(result.current.integrationId).toBe("integration-2");
    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-2",
      range: "1h",
      from: undefined,
      to: undefined,
    });
  });

  it("keeps submitted filters unchanged when reset only restores custom draft dates", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper("/snapshots?integrationId=integration-1&range=custom&from=2026-04-06T00%3A10&to=2026-04-06T00%3A40"),
    });
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    act(() => {
      result.current.setFrom("2026-04-06T00:20");
      result.current.setTo("2026-04-06T00:50");
      result.current.handleResetFilters();
    });

    expect(result.current.from).toBe(toLocalDateTimeInputValue(oneHourAgo));
    expect(result.current.to).toBe(toLocalDateTimeInputValue(now));
    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-1",
      range: "custom",
      from: "2026-04-06T00:10",
      to: "2026-04-06T00:40",
    });
  });

  it("does not apply when integration is missing and clears active action manually", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper("/snapshots"),
    });

    act(() => {
      result.current.handleApplyFilters();
    });
    expect(result.current.submittedFilters.integrationId).toBe("");

    act(() => {
      result.current.clearActiveFilterAction();
    });
    expect(result.current.activeFilterAction).toBeNull();
  });

  it("applies current filters when integration is set and apply is clicked", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper("/snapshots?integrationId=integration-1&range=custom&from=2026-04-06T00%3A10&to=2026-04-06T00%3A40"),
    });

    act(() => {
      result.current.handleApplyFilters();
    });

    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-1",
      range: "custom",
      from: "2026-04-06T00:10",
      to: "2026-04-06T00:40",
    });
    expect(result.current.activeFilterAction).toBe("apply");
  });

  it("does not auto-apply integration change when custom range dates are incomplete", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper("/snapshots?integrationId=integration-1&range=custom&from=&to="),
    });

    act(() => {
      result.current.handleIntegrationChange("integration-2");
    });

    expect(result.current.integrationId).toBe("integration-2");
    expect(result.current.submittedFilters.integrationId).toBe("integration-1");
  });

  it("does not auto-apply when integration is cleared", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleIntegrationChange("");
    });

    expect(result.current.integrationId).toBe("");
    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-1",
      range: "1h",
      from: undefined,
      to: undefined,
    });
  });

  it("auto-applies integration change with valid custom range dates", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper("/snapshots?integrationId=integration-1&range=custom&from=2026-04-06T00%3A10&to=2026-04-06T00%3A40"),
    });

    act(() => {
      result.current.handleIntegrationChange("integration-3");
    });

    expect(result.current.integrationId).toBe("integration-3");
    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-3",
      range: "custom",
      from: "2026-04-06T00:10",
      to: "2026-04-06T00:40",
    });
  });

  it("does not auto-apply when selecting custom range", () => {
    const { result } = renderHook(() => useSnapshotFilters(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleRangeChange("custom");
    });

    expect(result.current.range).toBe("custom");
    expect(result.current.submittedFilters).toEqual({
      integrationId: "integration-1",
      range: "1h",
      from: undefined,
      to: undefined,
    });
  });
});

describe("useSnapshots", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads snapshots when enabled", async () => {
    const listSpy = vi.spyOn(snapshotsApi, "list").mockResolvedValue({
      integrationId: "integration-1",
      range: "1h",
      from: null,
      to: null,
      items: [],
    });

    const { result } = renderHook(
      () =>
        useSnapshots(
          {
            integrationId: "integration-1",
            range: "1h",
          },
          true,
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listSpy).toHaveBeenCalledWith({
      integrationId: "integration-1",
      range: "1h",
    });
  });

  it("does not call the API when disabled", async () => {
    const listSpy = vi.spyOn(snapshotsApi, "list").mockResolvedValue({
      integrationId: "integration-1",
      range: "1h",
      from: null,
      to: null,
      items: [],
    });

    const { result } = renderHook(
      () =>
        useSnapshots(
          {
            integrationId: "integration-1",
            range: "1h",
          },
          false,
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(listSpy).not.toHaveBeenCalled();
  });
});
