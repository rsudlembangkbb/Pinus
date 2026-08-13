// Hand-maintained equivalent of `wrangler types` output (kept in sync with
// wrangler.toml bindings). Regenerate with `npx wrangler types` if bindings
// change and diff against this file.
interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  APP_ENV: "development" | "staging" | "production";
  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  CORS_ORIGIN: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
}
