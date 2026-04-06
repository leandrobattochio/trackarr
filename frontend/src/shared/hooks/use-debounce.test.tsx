import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "@/shared/hooks/use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately and delays updates", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "alpha", delay: 300 },
    });

    expect(result.current).toBe("alpha");

    rerender({ value: "beta", delay: 300 });
    expect(result.current).toBe("alpha");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("alpha");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("beta");
  });

  it("cancels the previous timer when the value changes again", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: "first" },
    });

    rerender({ value: "second" });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "third" });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("third");
  });
});
