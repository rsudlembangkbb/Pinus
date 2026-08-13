const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<RefreshResult | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface RefreshResult {
  accessToken: string;
  user: unknown;
}

async function doRefresh(): Promise<RefreshResult | null> {
  const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    accessToken = null;
    return null;
  }
  const body = (await res.json()) as RefreshResult;
  accessToken = body.accessToken;
  return body;
}

/**
 * Refresh tokens rotate on every use (the old one is revoked server-side as
 * soon as a new one is issued), so two concurrent refresh calls racing on
 * the same stored cookie is not just wasteful -- the loser gets a genuine
 * 401 because its token was invalidated out from under it. This singleton
 * promise is what every caller (the 401-retry path below, and
 * AuthContext's initial-load check) must go through instead of hitting
 * doRefresh() directly, so concurrent callers share one in-flight refresh.
 */
export function refreshSession(): Promise<RefreshResult | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isForm?: boolean;
  responseType?: "json" | "blob";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    let body: BodyInit | undefined;
    if (options.isForm) {
      body = options.body as FormData;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    return fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      credentials: "include",
    });
  };

  let res = await doFetch();

  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshed = await refreshSession();
    if (refreshed) res = await doFetch();
  }

  if (!res.ok) {
    let code = "UNKNOWN";
    let message = `Request gagal (${res.status})`;
    let details: unknown;
    try {
      const errBody = (await res.json()) as { error?: { code: string; message: string; details?: unknown } };
      if (errBody.error) {
        code = errBody.error.code;
        message = errBody.error.message;
        details = errBody.error.details;
      }
    } catch {
      // non-JSON error body, keep defaults
    }
    throw new ApiError(res.status, code, message, details);
  }

  if (options.responseType === "blob") return (await res.blob()) as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form, isForm: true }),
  getBlob: (path: string) => request<Blob>(path, { responseType: "blob" }),
};

export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await api.getBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
