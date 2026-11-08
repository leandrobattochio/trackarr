import type { ApiProxy, ProxyDto, ProxyType } from "@/features/proxies/types";

export interface ProxyForm {
  name: string;
  type: ProxyType;
  host: string;
  port: string;
  username: string;
  password: string;
  passwordChanged: boolean;
}

export const DEFAULT_PORTS: Record<ProxyType, string> = { http: "8080", socks4: "1080", socks5: "1080" };

export function initialForm(proxy: ApiProxy | null): ProxyForm {
  return {
    name: proxy?.name ?? "",
    type: proxy?.type ?? "http",
    host: proxy?.host ?? "",
    port: proxy ? String(proxy.port) : DEFAULT_PORTS.http,
    username: proxy?.username ?? "",
    password: "",
    passwordChanged: false,
  };
}

export function validateProxyForm(form: ProxyForm): string | null {
  if (!form.name.trim()) return "Name is required.";
  if (!form.host.trim()) return "Host is required.";
  if (/[\s/]|:\/\//.test(form.host.trim())) return "Host must be a host name or an IP address, with no scheme or path.";
  const port = Number(form.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "Port must be between 1 and 65535.";
  return null;
}

export function toDto(form: ProxyForm): ProxyDto {
  const username = form.username.trim();
  return {
    name: form.name.trim(),
    type: form.type,
    host: form.host.trim(),
    port: Number(form.port),
    username: username || null,
    password: form.passwordChanged ? form.password : null,
  };
}
