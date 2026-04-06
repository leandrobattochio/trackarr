import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnimatedNumber } from "@/shared/hooks/use-animated-number";

describe("useAnimatedNumber", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16);
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      clearTimeout(handle);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("animates from the initial value to the target", () => {
    const { result } = renderHook(() => useAnimatedNumber(10, { duration: 100, initialValue: 0 }));

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(48);
    });

    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(10);

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(result.current).toBe(10);
  });

  it("supports linear easing and decimal rounding", () => {
    const { result } = renderHook(() =>
      useAnimatedNumber(1.5, {
        duration: 100,
        decimals: 1,
        initialValue: 0,
        easing: "linear",
      }),
    );

    act(() => {
      vi.advanceTimersByTime(64);
    });

    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(64);
    });

    expect(result.current).toBe(1.5);
  });

  it("cancels in-flight frames when target changes and on cleanup", () => {
    const cancelSpy = vi.fn((handle: number) => clearTimeout(handle));
    vi.stubGlobal("cancelAnimationFrame", cancelSpy);

    const { rerender, unmount } = renderHook(
      ({ target }) => useAnimatedNumber(target, { duration: 200, initialValue: 0 }),
      { initialProps: { target: 10 } },
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    rerender({ target: 20 });

    act(() => {
      vi.advanceTimersByTime(16);
    });

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
  });
});
