const API_BASE = "/api";

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? res.statusText);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export async function requestText(path: string, options?: RequestInit): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, options);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? res.statusText);
  }

  return res.text();
}
