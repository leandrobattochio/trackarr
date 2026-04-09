import { request } from "@/shared/api/http";
import type { ApiAboutInfo, ApiSettings } from "@/features/settings/types";

export const settingsApi = {
  get: () => request<ApiSettings>("/settings"),
  getAbout: () => request<ApiAboutInfo>("/about"),
  update: (settings: Pick<ApiSettings, "userAgent" | "checkForUpdates">) =>
    request<ApiSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};
