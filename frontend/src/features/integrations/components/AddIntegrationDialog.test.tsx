import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();

const pluginsState = {
  data: [] as unknown[],
  isLoading: false,
};

const createMutation = {
  mutate: vi.fn(),
  isPending: false,
};

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
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
  Button: ({ children, onClick, disabled, type = "button", ...props }: unknown) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: unknown) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: unknown) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, onOpenChange }: unknown) => (
    <div>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-dialog
      </button>
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: unknown) => <div>{children}</div>,
  DialogContent: ({ children }: unknown) => <div>{children}</div>,
  DialogHeader: ({ children }: unknown) => <div>{children}</div>,
  DialogTitle: ({ children }: unknown) => <h2>{children}</h2>,
  DialogDescription: ({ children }: unknown) => <p>{children}</p>,
}));

import { AddIntegrationDialog } from "@/features/integrations/components/AddIntegrationDialog";

const plugin = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  fields: [
    { name: "baseUrl", label: "Base URL", type: "text", required: true, sensitive: false },
    { name: "cron", label: "Cron", type: "cron", required: true, sensitive: false },
    { name: "required_ratio", label: "Required Ratio", type: "number", required: true, sensitive: false },
    { name: "username", label: "Username", type: "text", required: true, sensitive: false },
    { name: "password", label: "Password", type: "password", required: true, sensitive: true },
    { name: "plainPassword", label: "Plain Password", type: "password", required: false, sensitive: false },
  ],
  customFields: [
    { name: "passkey", label: "Passkey", type: "text", required: false, sensitive: true },
  ],
};

describe("AddIntegrationDialog", () => {
  it("validates required and typed fields before submit", () => {
    pluginsState.data = [plugin];
    pluginsState.isLoading = false;
    createMutation.isPending = false;
    createMutation.mutate.mockReset();

    render(<AddIntegrationDialog addedPluginIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));

    const form = screen.getByRole("button", { name: /Connect/i }).closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    expect(createMutation.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Base URL is required.")).toBeInTheDocument();
    expect(screen.getByText("Required Ratio is required.")).toBeInTheDocument();
    expect(screen.getByText("Cron is required.")).toBeInTheDocument();
    expect(screen.getByText("Username is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Base URL/i), { target: { value: "ftp://seedpool.org" } });
    fireEvent.change(screen.getByLabelText(/Cron/i), { target: { value: "* * *" } });

    expect(screen.getByText("Base URL must be a valid http:// or https:// URL.")).toBeInTheDocument();
    expect(screen.getByText("Cron must be a valid 5-part UTC cron expression.")).toBeInTheDocument();
  });

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

  it("shows validation errors for invalid custom fields", () => {
    pluginsState.data = [
      {
        ...plugin,
        customFields: [{ name: "customCron", label: "Custom Cron", type: "cron", required: true, sensitive: false }],
      },
    ];
    pluginsState.isLoading = false;

    render(<AddIntegrationDialog addedPluginIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));
    fireEvent.change(screen.getByLabelText(/Custom Cron/i), { target: { value: "* * *" } });

    expect(screen.getByText("Custom Cron must be a valid 5-part UTC cron expression.")).toBeInTheDocument();
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
    createMutation.mutate.mockReset();
    createMutation.mutate.mockImplementationOnce((_dto: unknown, options: unknown) => options.onSuccess());
    createMutation.mutate.mockImplementationOnce((_dto: unknown, options: unknown) => options.onError(new Error("create failed")));

    render(<AddIntegrationDialog addedPluginIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Seedpool/i }));

    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    const cronInput = screen.getByLabelText(/Cron/i);
    const ratioInput = screen.getByLabelText(/Required Ratio/i);
    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText("Password*");
    const plainPasswordInput = screen.getByLabelText(/Plain Password/i);
    const passkeyInput = screen.getByLabelText(/Passkey/i);

    expect(baseUrlInput).toHaveAttribute("type", "text");
    expect(cronInput).toHaveAttribute("placeholder", "0 * * * *");
    expect(ratioInput).toHaveAttribute("type", "number");
    expect(ratioInput).toHaveAttribute("step", "any");
    expect(usernameInput).toHaveAttribute("type", "text");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(plainPasswordInput).toHaveAttribute("type", "password");
    expect(passkeyInput).toHaveAttribute("type", "password");
    expect(screen.getByText("Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.")).toBeInTheDocument();

    fireEvent.change(baseUrlInput, { target: { value: " https://seedpool.org " } });
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
          baseUrl: "https://seedpool.org",
          cron: "0 * * * *",
          required_ratio: "1.5",
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
    fireEvent.change(screen.getByLabelText(/Base URL/i), { target: { value: "https://seedpool.org" } });
    fireEvent.change(screen.getByLabelText(/Cron/i), { target: { value: "0 * * * *" } });
    fireEvent.change(screen.getByLabelText(/Required Ratio/i), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: "seed-user" } });
    fireEvent.change(screen.getByLabelText("Password*"), { target: { value: "secret" } });
    fireEvent.submit(screen.getByRole("button", { name: /Connect/i }).closest("form") as HTMLFormElement);
    expect(screen.getByRole("alert")).toHaveTextContent("create failed");
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


