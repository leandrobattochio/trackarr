import { request, requestText } from "@/shared/api/http";
import type { ApiPluginListItem } from "@/features/plugins/types";

export const pluginApi = {
  list: () => request<ApiPluginListItem[]>("/plugins"),
  getDefinition: (pluginId: string) => requestText(`/plugins/${pluginId}`),
};
