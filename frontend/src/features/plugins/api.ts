import { ApiError, request, requestText } from "@/shared/api/http";
import type {
  ApiPluginDiff,
  ApiPluginListItem,
  ApiPluginBlockingIntegration,
  ApiPluginTestResult,
  PluginTestRequest,
  SavePluginResponse,
} from "@/features/plugins/types";

export const pluginApi = {
  list: () => request<ApiPluginListItem[]>("/plugins"),
  getDefinition: (pluginId: string) => requestText(`/plugins/${pluginId}`),
  getDiff: (pluginId: string) => request<ApiPluginDiff>(`/plugins/${pluginId}/diff`),
  createDefinition: (yaml: string) =>
    request<SavePluginResponse>("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: yaml,
    }),
  updateDefinition: (pluginId: string, yaml: string) =>
    request<SavePluginResponse>(`/plugins/${pluginId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/yaml" },
      body: yaml,
    }),
  test: (body: PluginTestRequest) =>
    request<ApiPluginTestResult>("/plugins/test", { method: "POST", body: JSON.stringify(body) }),
  deleteOverride: (pluginId: string) => request<void>(`/plugins/${pluginId}/override`, { method: "DELETE" }),
  deleteCustom: (pluginId: string) => request<void>(`/plugins/${pluginId}`, { method: "DELETE" }),
};

export function getBlockingIntegrations(error: unknown): ApiPluginBlockingIntegration[] | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }

  const integrations = (error.body as { integrations?: unknown } | null)?.integrations;
  return Array.isArray(integrations) ? (integrations as ApiPluginBlockingIntegration[]) : null;
}
