'use client';

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include'
  });
  const body = (await res.json().catch(() => ({ ok: false, error: 'Respons server tidak valid.' }))) as ApiResult<T>;
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `Permintaan gagal (${res.status}).`);
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'POST', body: payload ? JSON.stringify(payload) : undefined }),
  patch: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'PATCH', body: payload ? JSON.stringify(payload) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    fetch(path, { method: 'POST', body: formData, credentials: 'include' }).then(async (res) => {
      const body = (await res.json().catch(() => ({ ok: false, error: 'Respons server tidak valid.' }))) as ApiResult<T>;
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Unggah gagal (${res.status}).`);
      return body.data as T;
    })
};
