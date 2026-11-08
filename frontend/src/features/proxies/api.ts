import { request } from "@/shared/api/http";
import type { ApiProxy, ProxyDto, ProxyTestResult } from "@/features/proxies/types";

export const proxiesApi = {
  list: () => request<ApiProxy[]>("/proxies"),
  create: (dto: ProxyDto) =>
    request<ApiProxy>("/proxies", { method: "POST", body: JSON.stringify(dto) }),
  update: (id: string, dto: ProxyDto) =>
    request<ApiProxy>(`/proxies/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  delete: (id: string) => request<void>(`/proxies/${id}`, { method: "DELETE" }),
  test: (id: string | null, proxy: ProxyDto) =>
    request<ProxyTestResult>("/proxies/test", { method: "POST", body: JSON.stringify({ id, proxy }) }),
};
