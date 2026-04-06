import { request, requestText } from "@/shared/api/http";
import type { ApiPluginListItem, SavePluginResponse } from "@/features/plugins/types";

export const pluginApi = {
  list: () => request<ApiPluginListItem[]>("/plugins"),
  getDefinition: (pluginId: string) => requestText(`/plugins/${pluginId}`),
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
};
