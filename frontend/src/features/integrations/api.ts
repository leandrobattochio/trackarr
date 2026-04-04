import { request } from "@/shared/api/http";
import type {
  ApiIntegration,
  ApiPlugin,
  CreateIntegrationDto,
  UpdateIntegrationDto,
} from "@/features/integrations/types";

export const api = {
  integrations: {
    list: () => request<ApiIntegration[]>("/integrations"),
    create: (dto: CreateIntegrationDto) =>
      request<ApiIntegration>("/integrations", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateIntegrationDto) =>
      request<ApiIntegration>(`/integrations/${id}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      }),
    sync: (id: string) =>
      request<ApiIntegration>(`/integrations/${id}/sync`, { method: "POST" }),
    delete: (id: string) =>
      request<void>(`/integrations/${id}`, { method: "DELETE" }),
  },
  plugins: {
    list: () => request<ApiPlugin[]>("/plugins"),
  },
};
