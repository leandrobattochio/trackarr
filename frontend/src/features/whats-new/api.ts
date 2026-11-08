import { request } from "@/shared/api/http";
import type { ApiWhatsNew } from "@/features/whats-new/types";

export const whatsNewApi = {
  get: () => request<ApiWhatsNew>("/whats-new"),
  // appVersion is the installed version of the report shown, so a release installed while it was open stays unread.
  markRead: (seen?: { pluginChangeId: number; appVersion: string }) =>
    request<void>("/whats-new/read", {
      method: "POST",
      ...(seen === undefined ? {} : { body: JSON.stringify(seen) }),
    }),
};
