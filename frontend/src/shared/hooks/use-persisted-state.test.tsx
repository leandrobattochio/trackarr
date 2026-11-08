import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePersistedState } from "@/shared/hooks/use-persisted-state";

const KEY = "trackarr.test.persisted";
const parseNumber = (value: unknown) => (typeof value === "number" ? value : undefined);

describe("usePersistedState", () => {
  afterEach(() => window.localStorage.clear());

  it("starts from the fallback when nothing is stored, and stores it", () => {
    const { result } = renderHook(() => usePersistedState(KEY, 1, parseNumber));

    expect(result.current[0]).toBe(1);
    expect(window.localStorage.getItem(KEY)).toBe("1");
  });

  it("starts from the stored value", () => {
    window.localStorage.setItem(KEY, "7");

    const { result } = renderHook(() => usePersistedState(KEY, 1, parseNumber));

    expect(result.current[0]).toBe(7);
  });

  it("ignores a stored value the parser rejects", () => {
    window.localStorage.setItem(KEY, JSON.stringify("seven"));

    const { result } = renderHook(() => usePersistedState(KEY, 1, parseNumber));

    expect(result.current[0]).toBe(1);
  });

  it("stores every change, so a new mount gets it back", () => {
    const first = renderHook(() => usePersistedState(KEY, 1, parseNumber));

    act(() => first.result.current[1](2));
    act(() => first.result.current[1]((current) => current + 1));
    first.unmount();

    const second = renderHook(() => usePersistedState(KEY, 1, parseNumber));
    expect(second.result.current[0]).toBe(3);
  });
});
