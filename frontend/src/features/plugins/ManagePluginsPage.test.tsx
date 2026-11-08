import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
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
  Info: () => <svg data-testid="icon-info" />,
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

vi.mock("@/features/plugins/components/PluginTestButton", () => ({
  PluginTestButton: ({
    label,
    pluginId,
    pluginName,
    source,
    disabledReason,
  }: {
    label: string;
    pluginId: string | null;
    pluginName: string;
    source: unknown;
    disabledReason?: string | null;
  }) => (
    <button
      type="button"
      data-testid="plugin-test-button"
      data-plugin-id={pluginId ?? ""}
      data-plugin-name={pluginName}
      data-source={JSON.stringify(source)}
      data-disabled-reason={disabledReason ?? ""}
    >
      {label}
    </button>
  ),
}));

vi.mock("@/features/plugins/components/DeleteCustomPluginButton", () => ({
  DeleteCustomPluginButton: ({
    pluginId,
    pluginName,
    disabled,
    onDeleted,
  }: {
    pluginId: string;
    pluginName: string;
    disabled?: boolean;
    onDeleted: (pluginId: string) => void;
  }) => (
    <button
      type="button"
      data-testid="delete-custom-plugin"
      data-plugin-name={pluginName}
      disabled={disabled}
      onClick={() => onDeleted(pluginId)}
    >
      Delete
    </button>
  ),
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
  origin: "official" | "override" | "custom";
  version: string | null;
  baseVersion: string | null;
  latestOfficialVersion?: string | null;
  outdated?: boolean;
  lastSyncFailed?: boolean;
  orphan: boolean;
  deprecated: boolean;
  incompatible: boolean;
  incompatibleVersion: string | null;
  requiredAppVersion: string | null;
  incompatibleMessage: string | null;
  hiddenOfficial: boolean;
};

const officialStatus = {
  origin: "official" as const,
  version: "1.0.0",
  baseVersion: null,
  orphan: false,
  deprecated: false,
  incompatible: false,
  incompatibleVersion: null,
  requiredAppVersion: null,
  incompatibleMessage: null,
  hiddenOfficial: false,
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
  ...officialStatus,
};

const betaPlugin: PluginItem = {
  pluginId: "beta-plugin",
  displayName: "Beta Plugin",
  definitionValid: true,
  definitionError: null,
  dashboard: null,
  fields: [{ name: "username" }],
  customFields: [],
  ...officialStatus,
  origin: "custom",
  hiddenOfficial: true,
};

const notInstalledPlugin: PluginItem = {
  pluginId: "gamma-plugin",
  displayName: "gamma-plugin",
  definitionValid: false,
  definitionError: "Update trackarr to receive gamma-plugin 1.0.0: it requires plugin schema version 2.",
  dashboard: null,
  fields: [],
  customFields: [],
  ...officialStatus,
  version: null,
  incompatible: true,
  incompatibleVersion: "1.0.0",
  incompatibleMessage: "Update trackarr to receive gamma-plugin 1.0.0: it requires plugin schema version 2.",
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

function renderPage(initialEntry = "/plugins") {
  return render(<ManagePluginsPage />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });
}

describe("ManagePluginsPage", () => {
  it("extracts plugin ids from yaml definitions", () => {
    expect(tryGetPluginId("pluginId: seedpool")).toBe("seedpool");
    expect(tryGetPluginId('pluginId: "quoted-plugin"')).toBe("quoted-plugin");
    expect(tryGetPluginId("displayName: Missing Id")).toBeNull();
  });

  it("renders the plugin catalog, auto-selects the first plugin, and allows switching plugins", async () => {
    renderPage();

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

  it("shows each plugin's status badges and notices in the catalog", () => {
    renderPage();

    expect(screen.getAllByText("Official v1.0.0").length).toBeGreaterThan(0);
    expect(screen.getByText("Custom v1.0.0")).toBeInTheDocument();
    expect(screen.getByText(/An official plugin also uses the id beta-plugin/)).toBeInTheDocument();
    expect(screen.queryByText("Disk")).toBeNull();
  });

  it("explains a plugin that is not installed instead of loading its definition", async () => {
    catalogState.data = [notInstalledPlugin, betaPlugin];
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("gamma-plugin · not installed")).toBeInTheDocument();
    });

    expect(screen.getByText("Not installed")).toBeInTheDocument();
    expect(screen.getAllByText("Incompatible")).toHaveLength(2);
    expect(screen.getAllByText(notInstalledPlugin.incompatibleMessage!)).toHaveLength(2);
    expect(screen.queryByText("Needs Fixing")).toBeNull();
    expect(screen.queryByText("Plugin definition needs fixing")).toBeNull();
    expect(screen.queryByTestId("plugin-editor")).toBeNull();
    expect(vi.mocked(usePluginDefinition)).toHaveBeenLastCalledWith("gamma-plugin", false);
  });

  it("renders catalog and definition loading and error states", async () => {
    catalogState = {
      data: [],
      isLoading: true,
      error: null,
    };

    const { rerender } = renderPage();

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

    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);

    expect(screen.getByTestId("plugin-editor")).toHaveValue(NEW_PLUGIN_TEMPLATE);
    fireEvent.click(screen.getByRole("button", { name: /Clear Editor/i }));
    expect(screen.getByTestId("plugin-editor")).toHaveValue("");

    fireEvent.click(screen.getAllByRole("button", { name: /New Plugin/i })[0]);

    expect(screen.getByTestId("plugin-editor")).toHaveValue(NEW_PLUGIN_TEMPLATE);
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(
      screen.getByText("Create saves a new custom plugin. Its pluginId must not belong to an official plugin."),
    ).toBeInTheDocument();

    const customYaml = NEW_PLUGIN_TEMPLATE.replace("<your-plugin-id>", "custom-plugin");
    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: customYaml } });
    fireEvent.click(screen.getByRole("button", { name: /Create Plugin/i }));

    expect(createMutation.mutate).toHaveBeenCalledWith(
      customYaml,
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

    renderPage();

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

    renderPage();

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

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveAttribute("data-readonly", "true");
    });

    expect(screen.getAllByTestId("icon-loader").length).toBeGreaterThan(0);
  });

  it("selects the plugin named in the URL and links an outdated override to its review page", async () => {
    catalogState.data = [
      alphaPlugin,
      { ...betaPlugin, origin: "override", hiddenOfficial: false, baseVersion: "1.0.0", latestOfficialVersion: "1.1.0", outdated: true },
    ];
    renderPage("/plugins?plugin=beta-plugin");

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["beta-plugin"].data);
    });

    const warning = screen.getByTestId("editor-outdated-warning");
    expect(warning).toHaveTextContent("A newer official version v1.1.0 is available. Your edited copy is based on v1.0.0.");
    expect(warning).not.toHaveClass("text-destructive");
    expect(screen.getByRole("link", { name: "Review update" })).toHaveAttribute("href", "/plugins/beta-plugin/update");
    expect(screen.getAllByText("Outdated (official v1.1.0)").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Alpha Plugin/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("editor-outdated-warning")).toBeNull();
    });
  });

  it("highlights the editor warning when the outdated override's last sync failed", () => {
    catalogState.data = [{ ...alphaPlugin, origin: "override", baseVersion: "1.0.0", latestOfficialVersion: "1.1.0", outdated: true, lastSyncFailed: true }];
    renderPage();

    expect(screen.getByTestId("editor-outdated-warning")).toHaveClass("text-destructive");
  });

  it("offers Test with the editor YAML of the selected plugin", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["alpha-plugin"].data);
    });
    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "pluginId: alpha-plugin\n# unsaved" } });

    const testButton = screen.getByRole("button", { name: "Test" });
    expect(testButton).toHaveAttribute("data-plugin-id", "alpha-plugin");
    expect(testButton).toHaveAttribute("data-plugin-name", "Alpha Plugin");
    expect(testButton).toHaveAttribute("data-source", JSON.stringify({ yaml: "pluginId: alpha-plugin\n# unsaved" }));
    expect(testButton).toHaveAttribute("data-disabled-reason", "");

    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Test" })).toHaveAttribute("data-disabled-reason", "The editor is empty.");
  });

  it("tests a new draft with the pluginId its YAML declares", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New Plugin" }));
    await waitFor(() => expect(screen.getByTestId("plugin-editor")).toHaveValue(NEW_PLUGIN_TEMPLATE));
    expect(screen.getByRole("button", { name: "Test" })).toHaveAttribute("data-plugin-id", "");

    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "pluginId: my-tracker" } });
    expect(screen.getByRole("button", { name: "Test" })).toHaveAttribute("data-plugin-id", "my-tracker");

    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "displayName: No Id" } });
    const testButton = screen.getByRole("button", { name: "Test" });
    expect(testButton).toHaveAttribute("data-plugin-id", "");
    expect(testButton).toHaveAttribute("data-plugin-name", "this plugin");
  });

  it("asks to wait while the editor is busy and hides Test for a plugin that is not installed", async () => {
    updateMutation.isPending = true;
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Test" })).toHaveAttribute("data-disabled-reason", "Wait for the editor to finish.");
    });
    unmount();

    updateMutation.isPending = false;
    catalogState.data = [notInstalledPlugin];
    renderPage();
    expect(screen.queryByRole("button", { name: "Test" })).toBeNull();
  });

  it("starts New Plugin from the blank template with schemaVersion and a pluginId placeholder", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New Plugin" }));

    const value = (screen.getByTestId("plugin-editor") as HTMLTextAreaElement).value;
    expect(value).toBe(NEW_PLUGIN_TEMPLATE);
    expect(value).toMatch(/^schemaVersion: 2$/m);
    expect(value).toMatch(/^pluginId: <your-plugin-id>$/m);
    expect(tryGetPluginId(value)).toBeNull();
  });

  it("shows the API's message when a custom plugin is rejected", () => {
    const officialMessage =
      "Plugin id 'alpha-plugin' belongs to an official plugin, so a custom plugin cannot use it. " +
      "Choose another id, or edit the official plugin to keep your own copy of it.";
    createMutation.mutate.mockImplementation((_yaml: string, options?: { onError?: (error: Error) => void }) => {
      options?.onError?.(new Error(officialMessage));
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New Plugin" }));
    fireEvent.change(screen.getByTestId("plugin-editor"), { target: { value: "pluginId: alpha-plugin\nschemaVersion: 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Plugin/i }));

    expect(screen.getByText(officialMessage)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(`Create failed: ${officialMessage}`);
    expect(screen.getByRole("button", { name: /Create Plugin/i })).toBeInTheDocument();
  });

  it("offers Delete only for a custom plugin and selects another plugin once it is deleted", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["alpha-plugin"].data);
    });
    expect(screen.queryByTestId("delete-custom-plugin")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Beta Plugin/i }));
    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["beta-plugin"].data);
    });
    expect(screen.getByTestId("delete-custom-plugin")).toHaveAttribute("data-plugin-name", "Beta Plugin");

    fireEvent.click(screen.getByTestId("delete-custom-plugin"));

    await waitFor(() => {
      expect(screen.getByTestId("plugin-editor")).toHaveValue(definitionStates["alpha-plugin"].data);
    });
    expect(screen.queryByTestId("delete-custom-plugin")).toBeNull();
  });

  it("selects nothing after deleting the only plugin", async () => {
    catalogState.data = [betaPlugin];
    renderPage();

    await waitFor(() => expect(screen.getByTestId("delete-custom-plugin")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("delete-custom-plugin"));

    await waitFor(() => expect(screen.getByText("Select a plugin definition from the catalog to inspect it.")).toBeInTheDocument());
  });

  it("has no import, export or hide action", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("plugin-editor")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Beta Plugin/i }));

    expect(screen.queryByRole("button", { name: /import|export|hide|duplicate/i })).toBeNull();
  });
});
