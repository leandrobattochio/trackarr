import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginTestButton } from "@/features/plugins/components/PluginTestButton";
import { useIntegrations } from "@/features/integrations/hooks";
import type { ApiIntegration } from "@/features/integrations/types";
import { useTestPlugin } from "@/features/plugins/hooks";
import type { ApiPluginTestResult } from "@/features/plugins/types";

vi.mock("@/features/integrations/hooks", () => ({ useIntegrations: vi.fn() }));
vi.mock("@/features/plugins/hooks", () => ({ useTestPlugin: vi.fn() }));

function integration(overrides: Partial<ApiIntegration>): ApiIntegration {
  return {
    id: "11111111-aaaa-bbbb-cccc-000000000001",
    pluginId: "seedpool",
    dashboard: null,
    payload: {},
    url: "https://seedpool.org/",
    requiredRatio: null,
    lastSyncAt: null,
    nextAutomaticSyncAt: null,
    lastSyncResult: "success",
    configurationValid: true,
    configurationError: null,
    stats: null,
    ...overrides,
  };
}

const first = integration({});
const second = integration({ id: "22222222-aaaa-bbbb-cccc-000000000002", url: null, lastSyncResult: "authFailed" });
const failing = integration({ id: "44444444-aaaa-bbbb-cccc-000000000004", url: "https://mirror.seedpool.org/", lastSyncResult: "unknownError" });
const fresh = integration({ id: "55555555-aaaa-bbbb-cccc-000000000005", url: "https://new.seedpool.org/", lastSyncResult: null });
const other = integration({ id: "33333333-aaaa-bbbb-cccc-000000000003", pluginId: "asc", url: "https://asc.example/" });

const successResult: ApiPluginTestResult = {
  outcome: "success",
  steps: [{ name: "profile", method: "GET", path: "/api/user", statusCode: 200 }],
  stats: null,
  failedField: null,
  error: null,
};

let integrationsState: { data?: ApiIntegration[]; isLoading: boolean; error: Error | null };
let testMutation: {
  mutate: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  isPending: boolean;
  data?: ApiPluginTestResult;
  error: Error | null;
};

beforeEach(() => {
  integrationsState = { data: [first, other], isLoading: false, error: null };
  testMutation = { mutate: vi.fn(), reset: vi.fn(), isPending: false, data: undefined, error: null };
  vi.mocked(useIntegrations).mockImplementation(() => integrationsState as never);
  vi.mocked(useTestPlugin).mockImplementation(() => testMutation as never);
});

function renderButton(props: Partial<Parameters<typeof PluginTestButton>[0]> = {}) {
  return render(
    <PluginTestButton label="Test" pluginId="seedpool" pluginName="Seedpool" source={{ yaml: "pluginId: seedpool" }} {...props} />,
  );
}

describe("PluginTestButton", () => {
  it("runs the editor YAML with the only integration of the plugin, preselected", async () => {
    renderButton();

    expect(screen.queryByTestId("plugin-test-unavailable")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Test" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Test Seedpool");
    expect(dialog).toHaveTextContent("Runs the YAML in the editor, saved or not");
    expect(dialog).toHaveTextContent("No snapshot is saved and the integration is not changed.");
    expect(within(dialog).getAllByRole("radio")).toHaveLength(1);
    expect(within(dialog).getByRole("radio", { name: /seedpool\.org/ })).toBeChecked();
    expect(dialog).not.toHaveTextContent("asc.example");
    expect(testMutation.reset).toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Run test" }));
    expect(testMutation.mutate).toHaveBeenCalledWith({ integrationId: first.id, yaml: "pluginId: seedpool" });
  });

  it("asks which integration to use when the plugin has several", async () => {
    integrationsState.data = [first, second, failing, fresh, other];
    renderButton({ label: "Test official", source: { useOfficial: true } });

    fireEvent.click(screen.getByRole("button", { name: "Test official" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Test official Seedpool");
    expect(dialog).toHaveTextContent("Runs the official version, ignoring your override");

    const radios = within(dialog).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(dialog).toHaveTextContent("Last sync: success");
    expect(dialog).toHaveTextContent("Integration 22222222");
    expect(dialog).toHaveTextContent("Last sync: auth failed");
    expect(dialog).toHaveTextContent("Last sync: unknown error");
    expect(dialog).toHaveTextContent("Last sync: never synced");

    const run = within(dialog).getByRole("button", { name: "Run test" });
    expect(run).toBeDisabled();

    testMutation.reset.mockClear();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Integration 22222222/ }));
    expect(testMutation.reset).toHaveBeenCalled();
    expect(run).toBeEnabled();
    fireEvent.click(run);
    expect(testMutation.mutate).toHaveBeenCalledWith({ integrationId: second.id, useOfficial: true });
  });

  it("shows the result panel and a request error", async () => {
    testMutation.data = successResult;
    const { unmount } = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(await screen.findByTestId("plugin-test-result")).toHaveAttribute("data-outcome", "success");
    unmount();

    testMutation.data = undefined;
    testMutation.error = new Error("Integration not found.");
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(await screen.findByTestId("plugin-test-request-error")).toHaveTextContent("Test failed to run: Integration not found.");
  });

  it("disables Run test while the test runs and closes the dialog", async () => {
    testMutation.isPending = true;
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Run test" })).toBeDisabled();

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is disabled with an explanation when no integration uses the plugin", () => {
    integrationsState.data = [other];
    renderButton();

    const button = screen.getByRole("button", { name: "Test" });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("plugin-test-unavailable")).toHaveTextContent(
      "No integration uses Seedpool. Add one to test this plugin with its settings.",
    );
    expect(button).toHaveAttribute("title", "No integration uses Seedpool. Add one to test this plugin with its settings.");
  });

  it.each([
    ["the integrations are loading", () => (integrationsState = { data: undefined, isLoading: true, error: null }), {}, "Loading integrations…"],
    [
      "the integrations failed to load",
      () => (integrationsState = { data: undefined, isLoading: false, error: new Error("api down") }),
      {},
      "Could not load integrations: api down",
    ],
    ["the YAML has no pluginId", () => undefined, { pluginId: null }, "Set a pluginId in the YAML to test it."],
    ["the page gives a reason", () => undefined, { disabledReason: "The editor is empty." }, "The editor is empty."],
  ] as const)("is disabled when %s", (_name, arrange, props, reason) => {
    arrange();
    renderButton(props);

    expect(screen.getByRole("button", { name: "Test" })).toBeDisabled();
    expect(screen.getByTestId("plugin-test-unavailable")).toHaveTextContent(reason);
  });
});
