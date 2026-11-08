import { request } from "@/shared/api/http";
import type { ApiAboutInfo, ApiPluginDownloadStatus, ApiSettings } from "@/features/settings/types";

export const settingsApi = {
  get: () => request<ApiSettings>("/settings"),
  getAbout: () => request<ApiAboutInfo>("/about"),
  getPluginDownload: () => request<ApiPluginDownloadStatus>("/about/plugin-download"),
  update: (userAgent: string) =>
    request<ApiSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify({ userAgent }),
    }),
};
