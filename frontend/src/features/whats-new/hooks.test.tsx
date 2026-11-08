import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { whatsNewApi } from "@/features/whats-new/api";
import { useMarkWhatsNewRead, useWhatsNew, WHATS_NEW_KEY } from "@/features/whats-new/hooks";
import { whatsNewReport } from "@/features/whats-new/test-data";

vi.mock("@/features/whats-new/api", () => ({
  whatsNewApi: { get: vi.fn(), markRead: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

describe("What's New hooks", () => {
  it("loads the report", async () => {
    vi.mocked(whatsNewApi.get).mockResolvedValueOnce(whatsNewReport({ shouldAutoOpen: true }));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWhatsNew(), { wrapper });

    await waitFor(() => expect(result.current.data?.shouldAutoOpen).toBe(true));
  });

  it("invalidates the report after marking it read", async () => {
    vi.mocked(whatsNewApi.markRead).mockResolvedValueOnce(undefined);
    const { queryClient, wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useMarkWhatsNewRead(), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(whatsNewApi.markRead).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: WHATS_NEW_KEY });
  });
});
