// Generated shape of the Cloudflare bindings declared in wrangler.toml.
// Kept hand-written (rather than `wrangler types`) so it works without a
// live Cloudflare session during local type-checking.
interface CloudflareEnv {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  IMPORT_QUEUE: Queue<ImportQueueMessage>;
  APP_ENV: string;
  APP_NAME: string;
  JWT_SECRET: string;
}

interface ImportQueueMessage {
  batchId: string;
  source: 'simrs' | 'bpjs' | 'baraya' | 'kinerja';
  periodId: string;
  r2Key: string;
  uploadedBy: string;
}
