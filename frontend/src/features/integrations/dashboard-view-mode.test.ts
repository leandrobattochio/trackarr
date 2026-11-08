import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DASHBOARD_VIEW_MODE_STORAGE_KEY,
  isDashboardViewMode,
  useDashboardViewMode,
} from "@/features/integrations/dashboard-view-mode";

describe("dashboard view mode", () => {
  afterEach(() => window.localStorage.clear());

  it("accepts only the known modes", () => {
    expect(isDashboardViewMode("cards")).toBe(true);
    expect(isDashboardViewMode("list")).toBe(true);
    expect(isDashboardViewMode("table")).toBe(false);
    expect(isDashboardViewMode("")).toBe(false);
    expect(isDashboardViewMode(null)).toBe(false);
  });

  it("defaults to cards", () => {
    const { result } = renderHook(() => useDashboardViewMode());

    expect(result.current[0]).toBe("cards");
  });

  it("persists the chosen mode under its storage key", () => {
    const first = renderHook(() => useDashboardViewMode());

    act(() => first.result.current[1]("list"));

    expect(window.localStorage.getItem(DASHBOARD_VIEW_MODE_STORAGE_KEY)).toBe(JSON.stringify("list"));
    first.unmount();
    expect(renderHook(() => useDashboardViewMode()).result.current[0]).toBe("list");
  });

  it("falls back to cards for an unknown stored mode", () => {
    window.localStorage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, JSON.stringify("table"));

    const { result } = renderHook(() => useDashboardViewMode());

    expect(result.current[0]).toBe("cards");
  });
});
