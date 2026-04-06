import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();

const pluginsState = {
  data: [] as any[],
  isLoading: false,
};

const createMutation = {
  mutate: vi.fn(),
  isPending: false,
};

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

vi.mock("lucide-react", () => ({
  Plus: () => <svg data-testid="icon-plus" />,
  Check: () => <svg data-testid="icon-check" />,
  ChevronLeft: () => <svg data-testid="icon-back" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Search: () => <svg data-testid="icon-search" />,
}));

vi.mock("@/features/integrations/hooks", () => ({
  usePlugins: () => pluginsState,
  useCreateIntegration: () => createMutation,
}));

vi.mock("@/shared/hooks/use-debounce", () => ({
  useDebounce: (value: string) => value,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type = "button", ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-dialog
      </button>
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

import { AddIntegrationDialog } from "@/features/integrations/components/AddIntegrationDialog";

const plugin = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  fields: [
    { name: "cron", label: "Cron", type: "cron", required: true, sensitive: false },
    { name: "requiredRatio", label: "Required Ratio", type: "number", required: false, sensitive: false },
    { name: "username", label: "Username", type: "text", required: true, sensitive: false },
    { name: "password", label: "Password", type: "password", required: true, sensitive: true },
    { name: "plainPassword", label: "Plain Password", type: "password", required: false, sensitive: false },
  ],
  customFields: [
    { name: "passkey", label: "Passkey", type: "text", required: false, sensitive: true },
  ],
};

describe("AddIntegrationDialog", () => {
  it("renders loading and empty search states", () => {
    pluginsState.data = [];
    pluginsState.isLoading = true;

    const { rerender } = render(<AddIntegrationDialog addedPluginIds={[]} />);
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    pluginsState.isLoading = false;
    rerender(<AddIntegrationDialog addedPluginIds={[]} />);

    fireEvent.change(screen.getByPlaceholderText(/Search trackers/i), { target: { value: "none" } });
    expect(screen.getByText('No trackers match "none"')).toBeInTheDocument();
  });

  it("filters plugins, marks added plugin, and handles back navigation", () => {
    pluginsState.data = [plugin, { ...plugin, pluginId: "other", displayName: "Other Tracker" }];
    pluginsState.isLoading = false;

    render(<AddIntegrationDialog addedPluginIds={["other"]} />);

    fireEvent.change(screen.getByPlaceholderText(/Search trackers/i), { target: { value: "seed" } });
    expect(screen.getByText("Seedpool")).toBeInTheDocument();
    expect(screen.queryByText("Other Tracker")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search trackers/i), { target: { value: "other" } });
    expect(screen.getByText("Other Tracker")).toBeInTheDocument();
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search trackers/i), { target: { value: "seed" } });
    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));
    expect(screen.getByText("Custom Fields")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("icon-back").closest("button") as HTMLButtonElement);
    expect(screen.getByPlaceholderText(/Search trackers/i)).toBeInTheDocument();
  });

  it("submits integration create success and error flows, then resets on close", () => {
    pluginsState.data = [plugin];
    createMutation.isPending = false;
    createMutation.mutate.mockImplementationOnce((_dto: any, options: any) => options.onSuccess());
    createMutation.mutate.mockImplementationOnce((_dto: any, options: any) => options.onError(new Error("create failed")));

    render(<AddIntegrationDialog addedPluginIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));

    const cronInput = screen.getByLabelText(/Cron/i);
    const ratioInput = screen.getByLabelText(/Required Ratio/i);
    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText("Password*");
    const plainPasswordInput = screen.getByLabelText(/Plain Password/i);
    const passkeyInput = screen.getByLabelText(/Passkey/i);

    expect(cronInput).toHaveAttribute("placeholder", "0 * * * *");
    expect(ratioInput).toHaveAttribute("type", "number");
    expect(ratioInput).toHaveAttribute("step", "any");
    expect(usernameInput).toHaveAttribute("type", "text");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(plainPasswordInput).toHaveAttribute("type", "password");
    expect(passkeyInput).toHaveAttribute("type", "password");
    expect(screen.getByText("Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.")).toBeInTheDocument();

    fireEvent.change(cronInput, { target: { value: "0 * * * *" } });
    fireEvent.change(ratioInput, { target: { value: "1.5" } });
    fireEvent.change(usernameInput, { target: { value: "seed-user" } });
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.change(plainPasswordInput, { target: { value: "plain-secret" } });
    fireEvent.change(passkeyInput, { target: { value: "pk" } });

    fireEvent.submit(screen.getByRole("button", { name: /Connect/i }).closest("form") as HTMLFormElement);

    expect(createMutation.mutate).toHaveBeenCalledWith(
      {
        pluginId: "seedpool",
        payload: JSON.stringify({
          cron: "0 * * * *",
          requiredRatio: "1.5",
          username: "seed-user",
          password: "secret",
          plainPassword: "plain-secret",
          passkey: "pk",
        }),
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Seedpool integration added");

    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));
    fireEvent.submit(screen.getByRole("button", { name: /Connect/i }).closest("form") as HTMLFormElement);
    expect(toastError).toHaveBeenCalledWith("create failed");

    fireEvent.click(screen.getByTestId("icon-back").closest("button") as HTMLButtonElement);
    fireEvent.change(screen.getByPlaceholderText(/Search trackers/i), { target: { value: "seed" } });
    fireEvent.click(screen.getByText("close-dialog"));
    expect(screen.getByPlaceholderText(/Search trackers/i)).toHaveValue("");
  });

  it("renders connecting state and hides empty field sections", () => {
    pluginsState.data = [{ ...plugin, fields: [], customFields: [] }];
    createMutation.isPending = true;

    render(<AddIntegrationDialog addedPluginIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));

    expect(screen.queryByText("Connection")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom Fields")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connecting/i })).toBeDisabled();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });
});
