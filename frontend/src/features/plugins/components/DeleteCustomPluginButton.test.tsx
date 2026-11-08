import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { DeleteCustomPluginButton } from "@/features/plugins/components/DeleteCustomPluginButton";
import { useDeleteCustomPlugin } from "@/features/plugins/hooks";
import { ApiError } from "@/shared/api/http";

vi.mock("@/features/plugins/hooks", () => ({ useDeleteCustomPlugin: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type MutateOptions = { onSuccess?: () => void; onError?: (error: Error) => void };

let deleteMutation: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
let onDeleted: ReturnType<typeof vi.fn>;

beforeEach(() => {
  deleteMutation = { mutate: vi.fn(), isPending: false };
  onDeleted = vi.fn();
  vi.mocked(useDeleteCustomPlugin).mockImplementation(() => deleteMutation as never);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

function renderButton(disabled = false) {
  return render(
    <MemoryRouter>
      <DeleteCustomPluginButton pluginId="my-tracker" pluginName="My Tracker" disabled={disabled} onDeleted={onDeleted} />
    </MemoryRouter>,
  );
}

async function confirmDelete() {
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete plugin" }));
  return dialog;
}

describe("DeleteCustomPluginButton", () => {
  it("asks for confirmation, deletes the plugin and reports it", async () => {
    deleteMutation.mutate.mockImplementation((_id: string, options: MutateOptions) => options.onSuccess?.());
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete My Tracker?");
    expect(dialog).toHaveTextContent("deleted with no backup");

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete plugin" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith("my-tracker", expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith("My Tracker deleted.");
    expect(onDeleted).toHaveBeenCalledWith("my-tracker");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("lists the integrations that block the deletion", async () => {
    const message = "Plugin 'my-tracker' is used by 2 integration(s). Delete them first.";
    deleteMutation.mutate.mockImplementation((_id: string, options: MutateOptions) =>
      options.onError?.(
        new ApiError(message, 409, {
          error: message,
          integrations: [
            { id: "11111111-aaaa-bbbb-cccc-000000000001", url: "https://tracker.example/" },
            { id: "22222222-aaaa-bbbb-cccc-000000000002", url: null },
          ],
        }),
      ),
    );
    renderButton();

    const dialog = await confirmDelete();

    expect(dialog).toHaveTextContent("My Tracker is in use");
    expect(dialog).toHaveTextContent(message);
    const items = within(screen.getByTestId("delete-blocking-integrations")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "https://tracker.example/",
      "Integration 22222222-aaaa-bbbb-cccc-000000000002",
    ]);
    expect(within(dialog).getByRole("link", { name: "Open dashboard" })).toHaveAttribute("href", "/");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Delete My Tracker?");
  });

  it("closes with a toast on any other error", async () => {
    deleteMutation.mutate.mockImplementation((_id: string, options: MutateOptions) =>
      options.onError?.(new ApiError("Plugin 'my-tracker' not found.", 404, null)),
    );
    renderButton();

    await confirmDelete();

    expect(toast.error).toHaveBeenCalledWith("Delete failed: Plugin 'my-tracker' not found.");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("disables the actions while busy", async () => {
    const { unmount } = renderButton(true);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    unmount();

    deleteMutation.isPending = true;
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Delete plugin" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
