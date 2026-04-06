import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useSnapshotFilters } from "@/features/snapshots/hooks";

function toLocalDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function createWrapper(initialEntry = "/snapshots?integrationId=integration-1&range=1h") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
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
});
