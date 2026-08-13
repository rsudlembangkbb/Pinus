import type { MiddlewareHandler } from "hono";
import { createDb } from "../db/client.js";
import type { AppEnv } from "../lib/app-context.js";

export const dbMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
};
