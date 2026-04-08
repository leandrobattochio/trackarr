import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();

const pluginsState = {
  data: [] as unknown[],
};

const updateMutation = {
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
  Loader2: () => <svg data-testid="icon-loader" />,
  Pencil: () => <svg data-testid="icon-pencil" />,
  Info: () => <svg data-testid="icon-info" />,
}));

vi.mock("@/features/integrations/hooks", () => ({
  usePlugins: () => pluginsState,
  useUpdateIntegration: () => updateMutation,
}));

vi.mock("@/features/integrations/components/shared/MetricTooltip", () => ({
  MetricTooltip: ({ children }: unknown) => <div>{children}</div>,
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
        <select id={trigger.id as string | undefined} value={value} onChange={(event) => onValueChange?.(event.target.value)}>
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
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
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
      <button type="button" onClick={() => onOpenChange(true)}>open-dialog</button>
      <button type="button" onClick={() => onOpenChange(false)}>close-dialog</button>
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: unknown) => <div>{children}</div>,
  DialogContent: ({ children }: unknown) => <div>{children}</div>,
  DialogHeader: ({ children }: unknown) => <div>{children}</div>,
  DialogTitle: ({ children }: unknown) => <h2>{children}</h2>,
  DialogDescription: ({ children }: unknown) => <p>{children}</p>,
}));

import { EditIntegrationDialog } from "@/features/integrations/components/EditIntegrationDialog";
import type { TrackerIntegration } from "@/features/integrations/types";

const tracker: TrackerIntegration = {
  id: "tracker-1",
  pluginId: "seedpool",
  dashboard: { metrics: [] },
  byteUnitSystem: "binary",
  name: "Seedpool",
  payload: {
    baseUrl: "https://seedpool.org/",
    cron: "0 * * * *",
    requiredRatio: "1.5",
    password: "secret",
    plainPassword: "secret2",
    passkey: "pk",
  },
  url: null,
  ratio: 1.5,
  uploaded: 1,
  downloaded: 1,
  seedBonus: null,
  buffer: null,
  hitAndRuns: null,
  requiredRatio: 1,
  seedingTorrents: null,
  leechingTorrents: null,
  activeTorrents: null,
  lastSync: null,
  lastSyncExact: null,
  nextAutomaticSync: null,
  nextAutomaticSyncExact: null,
  status: "success",
  statusLabel: "success",
  configurationValid: true,
  configurationError: null,
};

const plugin = {
  pluginId: "seedpool",
  baseUrls: ["https://seedpool.org/", "https://alt.seedpool.org/"],
  fields: [
    { name: "cron", label: "Cron", description: "Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.", type: "cron", required: true, sensitive: false },
    { name: "requiredRatio", label: "Required Ratio", type: "number", required: false, sensitive: false },
    { name: "apiKey", label: "API Key", description: "Paste the API key issued by the tracker.", type: "text", required: false, sensitive: false },
    { name: "plainPassword", label: "Plain Password", type: "password", required: false, sensitive: false },
    { name: "password", label: "Password", type: "password", required: true, sensitive: true },
  ],
  customFields: [
    { name: "passkey", label: "Passkey", type: "text", required: false, sensitive: true },
  ],
};

describe("EditIntegrationDialog", () => {
  it("renders unavailable plugin state when plugin metadata is missing", () => {
    pluginsState.data = [];
    render(<EditIntegrationDialog tracker={tracker} />);
    expect(screen.getByText("Plugin configuration unavailable.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("close-dialog"));
  });

  it("renders and submits editable fields with success and error flows", () => {
    pluginsState.data = [plugin];
    updateMutation.isPending = false;
    updateMutation.mutate.mockImplementationOnce((_input: unknown, options: unknown) => options.onSuccess());
    updateMutation.mutate.mockImplementationOnce((_input: unknown, options: unknown) => options.onError(new Error("bad payload")));

    render(<EditIntegrationDialog tracker={tracker} />);
    fireEvent.click(screen.getByText("open-dialog"));

    const cronInput = screen.getByLabelText("Cron*");
    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    const ratioInput = screen.getByLabelText("Required Ratio");
    const apiKeyInput = screen.getByLabelText("API Key");
    const plainPasswordInput = screen.getByLabelText("Plain Password");
    const passwordInput = screen.getByLabelText("Password*");
    const passkeyInput = screen.getByLabelText("Passkey");

    expect(baseUrlInput).toHaveValue("https://seedpool.org/");
    expect(cronInput).toHaveValue("0 * * * *");
    expect(apiKeyInput).toHaveValue("");
    expect(plainPasswordInput).toHaveAttribute("type", "password");
    expect(plainPasswordInput).toHaveValue("secret2");
    expect(passwordInput).toHaveValue("");
    expect(passkeyInput).toHaveValue("");
    expect(passwordInput).toHaveAttribute("placeholder", "*****");
    expect(screen.getByText("Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.")).toBeInTheDocument();
    expect(screen.getByText("Paste the API key issued by the tracker.")).toBeInTheDocument();
    expect(screen.getAllByTestId("icon-info").length).toBeGreaterThan(0);

    fireEvent.change(baseUrlInput, { target: { value: "https://alt.seedpool.org/" } });
    fireEvent.change(ratioInput, { target: { value: "2.0" } });
    fireEvent.submit(screen.getByRole("button", { name: /Save changes/i }).closest("form") as HTMLFormElement);

    expect(updateMutation.mutate).toHaveBeenCalledWith(
      {
        id: "tracker-1",
        dto: {
          pluginId: "seedpool",
          payload: JSON.stringify({
            baseUrl: "https://alt.seedpool.org/",
            cron: "0 * * * *",
            requiredRatio: "2.0",
            apiKey: "",
            plainPassword: "secret2",
            password: "",
            passkey: "",
          }),
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Seedpool updated");

    fireEvent.submit(screen.getByRole("button", { name: /Save changes/i }).closest("form") as HTMLFormElement);
    expect(toastError).toHaveBeenCalledWith("Update failed: bad payload");
  });

  it("respects disabled/editing states and resets values on close", () => {
    pluginsState.data = [plugin];
    updateMutation.isPending = true;

    render(<EditIntegrationDialog tracker={tracker} disabled />);
    fireEvent.click(screen.getByText("open-dialog"));

    expect(screen.getByRole("button", { name: /Edit integration/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Saving\.\.\./i })).toBeDisabled();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Required Ratio"), { target: { value: "9.9" } });
    fireEvent.click(screen.getByText("close-dialog"));
    expect(screen.getByLabelText(/Base URL/i)).toHaveValue("https://seedpool.org/");
    expect(screen.getByLabelText("Required Ratio")).toHaveValue(1.5);
  });

  it("hides empty field sections", () => {
    pluginsState.data = [{ ...plugin, fields: [], customFields: [] }];
    updateMutation.isPending = false;

    render(<EditIntegrationDialog tracker={tracker} />);
    fireEvent.click(screen.getByText("open-dialog"));

    expect(screen.queryByText("Connection")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom Fields")).not.toBeInTheDocument();
  });
});


