import { paginationQuerySchema } from "@pinus/shared";
import type { Context } from "hono";

export function parsePagination(c: Context) {
  const parsed = paginationQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return { page: 1, pageSize: 25, search: undefined };
  return parsed.data;
}

export function offsetFor(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
