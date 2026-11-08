import { request } from "@/shared/api/http";
import type { ApiWhatsNew } from "@/features/whats-new/types";

export const whatsNewApi = {
  get: () => request<ApiWhatsNew>("/whats-new"),
  markRead: (pluginChangeId?: number) =>
    request<void>("/whats-new/read", {
      method: "POST",
      ...(pluginChangeId === undefined ? {} : { body: JSON.stringify({ pluginChangeId }) }),
    }),
};
