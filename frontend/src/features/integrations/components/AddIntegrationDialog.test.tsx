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
  Info: () => <svg data-testid="icon-info" />,
}));

vi.mock("@/features/integrations/hooks", () => ({
  usePlugins: () => pluginsState,
  useCreateIntegration: () => createMutation,
}));

vi.mock("@/shared/hooks/use-debounce", () => ({
  useDebounce: (value: string) => value,
}));

vi.mock("@/components/ui/select", () => {
  const React = require("react");

  const SelectTrigger = () => null;
  const SelectContent = ({ children }: { children: unknown }) => <>{children}</>;
  const SelectValue = () => null;
  const SelectItem = ({ children }: { children: unknown }) => <>{children}</>;

  function collectItems(children: unknown): Array<{ value: string; label: string }> {
    const items: Array<{ value: string; label: string }> = [];

    React.Children.forEach(children, (child: any) => {
      if (!React.isValidElement(child)) return;

      if (child.type === SelectItem) {
        items.push({ value: child.props.value, label: String(child.props.children) });
        return;
      }

      items.push(...collectItems(child.props?.children));
    });

    return items;
  }

  function findTrigger(children: unknown): Record<string, unknown> | null {
    for (const child of React.Children.toArray(children)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === SelectTrigger) return child.props;

      const nested = findTrigger(child.props?.children);
      if (nested) return nested;
    }

    return null;
  }

  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange?: (value: string) => void; children: unknown }) => {
      const trigger = findTrigger(children) ?? {};
      const items = collectItems(children);

      return (
        <select
          id={trigger.id as string | undefined}
          aria-invalid={trigger["aria-invalid"] as string | undefined}
          aria-describedby={trigger["aria-describedby"] as string | undefined}
          value={value}
          onChange={(event) => onValueChange?.(event.target.value)}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      );
    },
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
  };
});

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
  baseUrls: ["https://seedpool.org/", "https://alt.seedpool.org/"],
  fields: [
    { name: "cron", label: "Cron", description: "Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.", type: "cron", required: true, sensitive: false },
    { name: "required_ratio", label: "Required Ratio", type: "number", required: true, sensitive: false },
    { name: "username", label: "Username", description: "Enter the username of your account on the tracker.", type: "text", required: true, sensitive: false },
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
    expect(screen.getByLabelText(/Base URL/i)).toHaveValue("https://seedpool.org/");
    expect(screen.getByText("Required Ratio is required.")).toBeInTheDocument();
    expect(screen.getByText("Cron is required.")).toBeInTheDocument();
    expect(screen.getByText("Username is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Base URL/i), { target: { value: "https://alt.seedpool.org/" } });
    fireEvent.change(screen.getByLabelText(/Cron/i), { target: { value: "* * *" } });

    expect(screen.queryByText("Base URL is required.")).not.toBeInTheDocument();
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
        customFields: [{ name: "customCron", label: "Custom Cron", description: "Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.", type: "cron", required: true, sensitive: false }],
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

    expect(cronInput).toHaveAttribute("placeholder", "0 * * * *");
    expect(ratioInput).toHaveAttribute("type", "number");
    expect(ratioInput).toHaveAttribute("step", "any");
    expect(usernameInput).toHaveAttribute("type", "text");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(plainPasswordInput).toHaveAttribute("type", "password");
    expect(passkeyInput).toHaveAttribute("type", "password");
    expect(screen.getByText("Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.")).toBeInTheDocument();
    expect(screen.getByText("Enter the username of your account on the tracker.")).toBeInTheDocument();
    expect(screen.getAllByTestId("icon-info").length).toBeGreaterThan(0);

    expect(baseUrlInput).toHaveValue("https://seedpool.org/");

    fireEvent.change(baseUrlInput, { target: { value: "https://alt.seedpool.org/" } });
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
          baseUrl: "https://alt.seedpool.org/",
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


