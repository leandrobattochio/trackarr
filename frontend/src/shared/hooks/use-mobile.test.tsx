import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/shared/hooks/use-mobile";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("useIsMobile", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  let changeListener: (() => void) | undefined;

  beforeEach(() => {
    addEventListener.mockImplementation((_event, listener: () => void) => {
      changeListener = listener;
    });
    removeEventListener.mockImplementation((_event, listener: () => void) => {
      if (changeListener === listener) {
        changeListener = undefined;
      }
    });

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener,
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    addEventListener.mockReset();
    removeEventListener.mockReset();
    changeListener = undefined;
  });

  it("returns true when the viewport is below the mobile breakpoint", () => {
    setWindowWidth(640);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith("change", expect.unknown(Function));
  });

  it("updates when the media query listener fires and cleans up on unmount", () => {
    setWindowWidth(1024);

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setWindowWidth(500);
    act(() => {
      changeListener?.();
    });

    expect(result.current).toBe(true);

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.unknown(Function));
  });
});

