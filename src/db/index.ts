import { drizzle } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema';

/**
 * Returns a Drizzle client bound to the D1 database for the current
 * request. Must only be called inside a request handler (route handler,
 * middleware) running on the Cloudflare Workers runtime.
 */
export function getDb() {
  const { env } = getCloudflareContext<CloudflareEnv>();
  return drizzle(env.DB, { schema });
}

export function getEnv(): CloudflareEnv {
  const { env } = getCloudflareContext<CloudflareEnv>();
  return env;
}

export { schema };
