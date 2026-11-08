import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkWhatsNewRead, useWhatsNew } from "@/features/whats-new/hooks";
import { whatsNewReport } from "@/features/whats-new/test-data";
import type { ApiWhatsNew } from "@/features/whats-new/types";
import { useWhatsNewDialog } from "@/features/whats-new/whats-new-context";
import { WhatsNewProvider } from "@/features/whats-new/WhatsNewProvider";

vi.mock("@/features/whats-new/hooks", () => ({ useWhatsNew: vi.fn(), useMarkWhatsNewRead: vi.fn() }));
vi.mock("@/features/whats-new/components/WhatsNewDialog", () => ({
  WhatsNewDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div data-testid="whats-new-dialog">
        <button type="button" onClick={() => onOpenChange(true)}>
          Keep open
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

let queryState: { data?: ApiWhatsNew; isLoading: boolean; error: Error | null };
const mutate = vi.fn();

function MenuButton() {
  const { open, report } = useWhatsNewDialog();
  return (
    <button type="button" onClick={open}>
      What's New {report?.app.installedVersion}
    </button>
  );
}

function renderProvider() {
  return render(
    <WhatsNewProvider>
      <MenuButton />
    </WhatsNewProvider>,
  );
}

beforeEach(() => {
  mutate.mockReset();
  queryState = { data: whatsNewReport(), isLoading: false, error: null };
  vi.mocked(useWhatsNew).mockImplementation(() => queryState as never);
  vi.mocked(useMarkWhatsNewRead).mockReturnValue({ mutate } as never);
});

describe("WhatsNewProvider", () => {
  it("opens by itself once when shouldAutoOpen is true and marks everything read on close", () => {
    queryState.data = whatsNewReport({ shouldAutoOpen: true });
    const { rerender } = renderProvider();

    expect(screen.getByTestId("whats-new-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep open" }));
    expect(screen.getByTestId("whats-new-dialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("whats-new-dialog")).not.toBeInTheDocument();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ appVersion: queryState.data?.app.installedVersion });

    // A stale report that still says shouldAutoOpen does not reopen it.
    rerender(
      <WhatsNewProvider>
        <MenuButton />
      </WhatsNewProvider>,
    );
    expect(screen.queryByTestId("whats-new-dialog")).not.toBeInTheDocument();
  });

  it("stays closed when nothing is new and opens from the menu", () => {
    renderProvider();

    expect(screen.queryByTestId("whats-new-dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What's New 0.4.0" }));
    expect(screen.getByTestId("whats-new-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("whats-new-dialog")).not.toBeInTheDocument();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("does not mark anything read when the report never loaded", () => {
    queryState = { data: undefined, isLoading: false, error: new Error("boom") };
    renderProvider();

    act(() => fireEvent.click(screen.getByRole("button", { name: "What's New" })));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("useWhatsNewDialog", () => {
  it("is a no-op outside the provider", () => {
    render(<MenuButton />);

    fireEvent.click(screen.getByRole("button", { name: "What's New" }));
    expect(screen.queryByTestId("whats-new-dialog")).not.toBeInTheDocument();
  });
});
