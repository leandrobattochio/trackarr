import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reducer, useToast } from "@/shared/hooks/use-toast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("keeps only the most recent toast when the limit is reached", () => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "First" });
      result.current.toast({ title: "Second" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.title).toBe("Second");

    act(() => {
      result.current.dismiss();
      vi.runAllTimers();
    });

    unmount();
  });

  it("updates and removes a toast through its public controls", () => {
    const { result, unmount } = renderHook(() => useToast());

    let controls: ReturnType<typeof result.current.toast> | undefined;

    act(() => {
      controls = result.current.toast({ title: "Initial", description: "Before update" });
    });

    expect(result.current.toasts[0]).toMatchObject({
      id: controls?.id,
      title: "Initial",
      open: true,
    });

    act(() => {
      controls?.update({ title: "Updated" } as Parameters<typeof controls.update>[0]);
    });

    expect(result.current.toasts[0]?.title).toBe("Updated");

    act(() => {
      result.current.toasts[0]?.onOpenChange?.(false);
    });

    expect(result.current.toasts[0]?.open).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toEqual([]);

    unmount();
  });

  it("does not enqueue duplicate removals for the same toast id", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const { result, unmount } = renderHook(() => useToast());

    let controls: ReturnType<typeof result.current.toast> | undefined;

    act(() => {
      controls = result.current.toast({ title: "Queue Once" });
    });

    act(() => {
      result.current.dismiss(controls?.id);
      result.current.dismiss(controls?.id);
    });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe("toast reducer", () => {
  it("removes one toast or all toasts depending on the action payload", () => {
    const initialState = {
      toasts: [
        { id: "toast-1", title: "First", open: true },
        { id: "toast-2", title: "Second", open: true },
      ],
    };

    expect(reducer(initialState, { type: "REMOVE_TOAST", toastId: "toast-1" })).toEqual({
      toasts: [{ id: "toast-2", title: "Second", open: true }],
    });

    expect(reducer(initialState, { type: "REMOVE_TOAST" })).toEqual({
      toasts: [],
    });
  });

  it("dismisses only matching toast id and keeps non-target toasts open", () => {
    const initialState = {
      toasts: [
        { id: "toast-1", title: "First", open: true },
        { id: "toast-2", title: "Second", open: true },
      ],
    };

    expect(reducer(initialState, { type: "DISMISS_TOAST", toastId: "toast-1" })).toEqual({
      toasts: [
        { id: "toast-1", title: "First", open: false },
        { id: "toast-2", title: "Second", open: true },
      ],
    });
  });

  it("updates only the matching toast and leaves others unchanged", () => {
    const initialState = {
      toasts: [
        { id: "toast-1", title: "First", open: true },
        { id: "toast-2", title: "Second", open: true },
      ],
    };

    expect(
      reducer(initialState, {
        type: "UPDATE_TOAST",
        toast: { id: "toast-1", title: "Updated" },
      }),
    ).toEqual({
      toasts: [
        { id: "toast-1", title: "Updated", open: true },
        { id: "toast-2", title: "Second", open: true },
      ],
    });
  });
});
