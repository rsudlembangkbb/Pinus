import { defineConfig } from "drizzle-kit";

// Used only for `drizzle-kit studio` (local schema browsing against the D1
// sqlite file produced by `wrangler d1 migrations apply --local`). Schema
// migrations themselves are hand-written SQL under ./migrations, applied via
// `wrangler d1 migrations apply` -- not drizzle-kit generate/push -- so this
// config intentionally has no `out` migrations directory wired to `generate`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite",
  },
});
