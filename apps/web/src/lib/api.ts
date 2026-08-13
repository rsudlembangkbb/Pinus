const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  isFormData?: boolean;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.isFormData
      ? undefined
      : {
          "Content-Type": "application/json",
        },
    body: options.body
      ? options.isFormData
        ? (options.body as BodyInit)
        : JSON.stringify(options.body)
      : undefined,
  });

  if (!response.ok) {
    let message = "Terjadi kesalahan pada server.";
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) {
        message = payload.message.join(", ");
      } else if (payload.message) {
        message = payload.message;
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function buildApiUrl(path: string) {
  return `${API_URL}${path}`;
}
