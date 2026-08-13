import * as XLSX from "xlsx";

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function fromUtf8(text: string) {
  return new TextEncoder().encode(text);
}

async function deriveBits(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", fromUtf8(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromUtf8(salt),
      iterations: 210_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
}

export async function hashPassword(password: string) {
  const salt = crypto.randomUUID();
  const hash = await deriveBits(password, salt);
  return `pbkdf2$${salt}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, digest] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !salt || !digest) {
    return false;
  }
  const hash = await deriveBits(password, salt);
  return toBase64(hash) === digest;
}

export async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", fromUtf8(text));
  return Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function badRequest(error: string, details?: string[]) {
  return Response.json(
    {
      error,
      details,
    },
    { status: 400 },
  );
}

export function unauthorized(error = "Autentikasi diperlukan") {
  return Response.json({ error }, { status: 401 });
}

export function forbidden(error = "Akses ditolak") {
  return Response.json({ error }, { status: 403 });
}

export function jsonOk<T>(payload: T, init?: ResponseInit) {
  return Response.json(payload, init);
}

export function parseNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function parseCsvOrXlsx(fileName: string, buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[key.trim()] = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    });
    normalized.__fileName = fileName;
    return normalized;
  });
}

export function buildCookie(name: string, value: string, secure: boolean, maxAgeSeconds: number) {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "SameSite=None" : "SameSite=Lax",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearCookie(name: string, secure: boolean) {
  return buildCookie(name, "", secure, 0);
}

export function parseCookie(cookieHeader: string | undefined, key: string) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${key}=`));

  return match ? match.slice(key.length + 1) : null;
}

export function nowIso() {
  return new Date().toISOString();
}
