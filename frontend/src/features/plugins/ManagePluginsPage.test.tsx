import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagePluginsPage from "@/features/plugins/ManagePluginsPage";
import { tryGetPluginId } from "@/features/plugins/plugin-id";
import { NEW_PLUGIN_TEMPLATE } from "@/features/plugins/plugin-template";
import {
  useCreatePluginDefinition,
  usePluginCatalog,
  usePluginDefinition,
  useUpdatePluginDefinition,
} from "@/features/plugins/hooks";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { toast } from "sonner";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange, options }: { value?: string; onChange?: (value?: string) => void; options?: { readOnly?: boolean } }) => (
    <>
      <textarea
        data-testid="plugin-editor"
        data-readonly={String(Boolean(options?.readOnly))}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <button type="button" onClick={() => onChange?.(undefined)}>
        Clear Editor
      </button>
    </>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="icon-alert" />,
  FolderOpen: () => <svg data-testid="icon-folder" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Save: () => <svg data-testid="icon-save" />,
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/features/plugins/hooks", () => ({
  usePluginCatalog: vi.fn(),
  usePluginDefinition: vi.fn(),
  useCreatePluginDefinition: vi.fn(),
  useUpdatePluginDefinition: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => <section className={className}>{children}</section>,
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

type PluginItem = {
  pluginId: string;
  displayName: string;
  definitionValid: boolean;
  definitionError: string | null;
  dashboard: null;
  fields: { name: string }[];
  customFields: { name: string }[];
};

type DefinitionState = {
  data?: string;
  isLoading: boolean;
  error: Error | null;
};

const alphaPlugin: PluginItem = {
  pluginId: "alpha-plugin",
  displayName: "Alpha Plugin",
  definitionValid: false,
  definitionError: "alpha definition is invalid",
  dashboard: null,
  fields: [{ name: "apiKey" }],
  customFields: [{ name: "profileId" }],
};

const betaPlugin: PluginItem = {
  pluginId: "beta-plugin",
  displayName: "Beta Plugin",
  definitionValid: true,
  definitionError: null,
  dashboard: null,
  fields: [{ name: "username" }],
  customFields: [],
};

let catalogState: { data: PluginItem[]; isLoading: boolean; error: Error | null };
let definitionStates: Record<string, DefinitionState>;
let disabledDefinitionState: DefinitionState;
let createMutation: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
let updateMutation: { mutate: ReturnType<typeof vi.fn>; isPending: boolean };

beforeEach(() => {
  catalogState = {
    data: [alphaPlugin, betaPlugin],
    isLoading: false,
    error: null,
  };

  definitionStates = {
    "alpha-plugin": { data: 'pluginId: alpha-plugin\ndisplayName: "Alpha Plugin"', isLoading: false, error: null },
    "beta-plugin": { data: 'pluginId: beta-plugin\ndisplayName: "Beta Plugin"', isLoading: false, error: null },
    "new-plugin": { data: 'pluginId: new-plugin\ndisplayName: "New Plugin"', isLoading: false, error: null },
  };

  disabledDefinitionState = { data: undefined, isLoading: false, error: null };
  createMutation = { mutate: vi.fn(), isPending: false };
  updateMutation = {
    mutate: vi.fn((_variables: { pluginId: string; yaml: string }, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    }),
    isPending: false,
  };

  vi.mocked(usePageTitle).mockImplementation(() => {});
  vi.mocked(usePluginCatalog).mockImplementation(() => catalogState as never);
  vi.mocked(usePluginDefinition).mockImplementation((pluginId: string, enabled: boolean) => {
    if (!enabled) {
      return disabledDefinitionState as never;
    }

    return (definitionStates[pluginId] ?? { data: "", isLoading: false, error: null }) as never;
  });
  vi.mocked(useCreatePluginDefinition).mockImplementation(() => createMutation as never);
  vi.mocked(useUpdatePluginDefinition).mockImplementation(() => updateMutation as never);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("ManagePluginsPage", () => {
  it("extracts plugin ids from yaml definitions", () => {
    expect(tryGetPluginId("pluginId: seedpool")).toBe("seedpool");
    expect(tryGetPluginId('pluginId: "quoted-plugin"')).toBe("quoted-plugin");
    expect(tryGetPluginId("displayName: Missing Id")).toBeNull();
  });

  it("renders the plugin catalog, auto-selects the first plugin, and allows switching plugins", async () => {
    render(<ManagePluginsPage />);

    expect(usePageTitle).toHaveBeenCalledWith("TrackArr | Manage Plugins");
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByText("Manage Plugins")).toBeInTheDocument();
    expect(screen.getByText("Loaded")).toBeInTheDocument();
    expect(screen.getByText("Needs Fixing")).toBeInTheDocument();
    expect(screen.getByText("Definition invalid")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["alpha-plugin"].data);
    });

    expect(screen.getByText("Plugin definition needs fixing")).toBeInTheDocument();
    expect(screen.getByText("alpha definition is invalid")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("alpha-plugin · editable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Beta Plugin/i }));

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["beta-plugin"].data);
    });

    expect(screen.queryByText("Plugin definition needs fixing")).not.toBeInTheDocument();
    expect(screen.getByText("1 fields")).toBeInTheDocument();
    expect(screen.getByText("beta-plugin · editable")).toBeInTheDocument();
  });

  it("renders catalog and definition loading and error states", async () => {
    catalogState = {
      data: [],
      isLoading: true,
      error: null,
    };

    const { rerender } = render(<ManagePluginsPage />);

    expect(screen.getAllByTestId("skeleton")).toHaveLength(5);

    catalogState = {
      data: [],
      isLoading: false,
      error: new Error("catalog down"),
    };

    rerender(<ManagePluginsPage />);
    expect(screen.getByText("Failed to load plugins: catalog down")).toBeInTheDocument();

    catalogState = {
      data: [alphaPlugin],
      isLoading: false,
      error: null,
    };
    definitionStates["alpha-plugin"] = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    rerender(<ManagePluginsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    });

    definitionStates["alpha-plugin"] = {
      data: undefined,
      isLoading: false,
      error: new Error("yaml down"),
    };

    rerender(<ManagePluginsPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load plugin YAML: yaml down")).toBeInTheDocument();
    });
  });

  it("creates a new plugin and handles success with and without a parsed plugin id", async () => {
    let createCalls = 0;
    createMutation.mutate.mockImplementation((yaml: string, options?: { onSuccess?: () => void }) => {
      createCalls += 1;
      options?.onSuccess?.();
    });

    render(<ManagePluginsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);

    expect(screen.getByTestId("plugin-editor")).toHaveValue(NEW_PLUGIN_TEMPLATE);
    fireEvent.click(screen.getByRole("button", { name: /Clear Editor/i }));
    expect(screen.getByTestId("plugin-editor")).toHaveValue("");

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);

    expect(screen.getByTestId("plugin-editor")).toHaveValue(NEW_PLUGIN_TEMPLATE);
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Create writes a new physical YAML file into the plugin directory.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Plugin/i }));

    expect(createMutation.mutate).toHaveBeenCalledWith(
      NEW_PLUGIN_TEMPLATE,
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Plugin created.");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Save$/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "pluginId: custom-plugin\nupdated: true" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(updateMutation.mutate).toHaveBeenCalledWith(
      { pluginId: "custom-plugin", yaml: "pluginId: custom-plugin\nupdated: true" },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);
    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "displayName: Missing plugin id" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Plugin/i }));

    expect(createCalls).toBe(2);
    expect(toast.success).toHaveBeenCalledWith("custom-plugin saved.");
    expect(toast.success).toHaveBeenCalledTimes(3);
  });

  it("returns early when saving without a selected plugin after creating from an empty catalog", async () => {
    catalogState = {
      data: [],
      isLoading: false,
      error: null,
    };
    createMutation.mutate.mockImplementation((_yaml: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    render(<ManagePluginsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);
    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "displayName: Missing plugin id" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Plugin/i }));
    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "displayName: still missing plugin id" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(updateMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows create errors, updates an existing plugin, and clears submit errors on edit", async () => {
    createMutation.mutate.mockImplementation((_yaml: string, options?: { onError?: (error: Error) => void }) => {
      options?.onError?.(new Error("create failed"));
    });
    updateMutation.mutate.mockImplementation(
      (
        variables: { pluginId: string; yaml: string },
        options?: {
          onSuccess?: () => void;
          onError?: (error: Error) => void;
        },
      ) => {
        if (variables.yaml.includes("broken")) {
          options?.onError?.(new Error("save failed"));
          return;
        }

        options?.onSuccess?.();
      },
    );

    render(<ManagePluginsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Create Plugin/i }));

    expect(screen.getByText("create failed")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Create failed: create failed");

    fireEvent.click(screen.getByRole("button", { name: /Alpha Plugin/i }));

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["alpha-plugin"].data);
    });

    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "pluginId: alpha-plugin\nbroken: true" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(updateMutation.mutate).toHaveBeenCalledWith(
      { pluginId: "alpha-plugin", yaml: "pluginId: alpha-plugin\nbroken: true" },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(screen.getByText("save failed")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Save failed: save failed");

    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "pluginId: alpha-plugin\nfixed: true" } });

    await waitFor(() => {
      expect(screen.queryByText("save failed")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(toast.success).toHaveBeenCalledWith("Alpha Plugin saved.");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Save$/i })).toBeDisabled();
    });
  });

  it("handles busy editor states for create and update mutations", async () => {
    createMutation.isPending = true;
    updateMutation.isPending = true;

    render(<ManagePluginsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveAttribute("data-readonly", "true");
    });

    expect(screen.getAllByTestId("icon-loader").length).toBeGreaterThan(0);
  });
});


