const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function toApiError(res: Response) {
  const body = await res.json().catch(() => null);
  return new ApiError(body?.error ?? res.statusText, res.status, body);
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw await toApiError(res);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export async function requestText(path: string, options?: RequestInit): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, options);

  if (!res.ok) {
    throw await toApiError(res);
  }

  return res.text();
}
