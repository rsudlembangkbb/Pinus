export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (message = "Autentikasi diperlukan") => new HttpError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Anda tidak memiliki hak akses untuk aksi ini") =>
    new HttpError(403, "FORBIDDEN", message),
  notFound: (entity: string) => new HttpError(404, "NOT_FOUND", `${entity} tidak ditemukan`),
  conflict: (message: string) => new HttpError(409, "CONFLICT", message),
  validation: (message: string, details?: unknown) => new HttpError(422, "VALIDATION_ERROR", message, details),
  badRequest: (message: string) => new HttpError(400, "BAD_REQUEST", message),
};
