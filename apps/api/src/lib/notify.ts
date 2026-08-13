import { eq } from "drizzle-orm";
import type { NotificationKind } from "@pinus/shared";
import { schema, type Database } from "../db/client.js";
import { newId } from "./ids.js";

interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body: string;
  relatedPeriodId?: string | null;
}

const INSERT_CHUNK = 20;

export async function notifyUsers(db: Database, userIds: string[], input: NotifyInput): Promise<void> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  const rows = uniqueIds.map((userId) => ({
    id: newId(),
    userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    relatedPeriodId: input.relatedPeriodId ?? null,
  }));
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db.insert(schema.notifications).values(rows.slice(i, i + INSERT_CHUNK));
  }
}

export async function notifyByRole(db: Database, roleCode: string, input: NotifyInput): Promise<void> {
  const users = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.roleCode, roleCode));
  await notifyUsers(db, users.map((u) => u.id), input);
}

export async function notifyByWorkUnit(db: Database, workUnitId: string, input: NotifyInput): Promise<void> {
  const rows = await db
    .select({ userId: schema.userWorkUnits.userId })
    .from(schema.userWorkUnits)
    .where(eq(schema.userWorkUnits.workUnitId, workUnitId));
  await notifyUsers(db, rows.map((r) => r.userId), input);
}
