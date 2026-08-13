import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { offsetFor, parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const auditRoutes = new Hono<AppEnv>();
auditRoutes.use("*", requireAuth, requirePermission("audit.read"));

auditRoutes.get("/", async (c) => {
  const db = c.get("db");
  const { page, pageSize } = parsePagination(c);
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
  const action = c.req.query("action");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const conditions = [
    entityType ? eq(schema.auditLogs.entityType, entityType) : undefined,
    entityId ? eq(schema.auditLogs.entityId, entityId) : undefined,
    action ? eq(schema.auditLogs.action, action) : undefined,
    from ? gte(schema.auditLogs.createdAt, from) : undefined,
    to ? lte(schema.auditLogs.createdAt, to) : undefined,
  ].filter(Boolean);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(schema.auditLogs)
    .where(where)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(pageSize)
    .offset(offsetFor(page, pageSize));

  const totalRows = await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(where);

  return c.json({
    items: items.map((r) => ({
      ...r,
      before: r.beforeJson ? JSON.parse(r.beforeJson) : null,
      after: r.afterJson ? JSON.parse(r.afterJson) : null,
    })),
    total: totalRows.length,
    page,
    pageSize,
  });
});
