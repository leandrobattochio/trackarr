export const PROXY_TYPES = ["http", "socks4", "socks5"] as const;

export type ProxyType = (typeof PROXY_TYPES)[number];

export const PROXY_TYPE_LABELS: Record<ProxyType, string> = {
  http: "HTTP",
  socks4: "SOCKS4",
  socks5: "SOCKS5",
};

export interface ApiProxy {
  id: string;
  name: string;
  type: ProxyType;
  host: string;
  port: number;
  username: string | null;
  hasPassword: boolean;
}

// password: null keeps the stored password, "" clears it.
export interface ProxyDto {
  name: string;
  type: ProxyType;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
}

export interface ProxyTestResult {
  success: boolean;
  testUrl: string;
  statusCode: number | null;
  error: string | null;
}

export interface ProxyInUseBody {
  error: string;
  integrations: Array<{ id: string; name: string }>;
}
