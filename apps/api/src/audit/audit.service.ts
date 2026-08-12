import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Central write path for the immutable audit trail (PRD §5.7 / §15 AC #3).
 * Every master-data mutation, parameter change, import commit, calculation
 * run, and approval decision must call this instead of writing AuditLog
 * rows directly, so the log format stays consistent and queryable.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  async findAll(params: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId,
      createdAt:
        params.from || params.to
          ? { gte: params.from, lte: params.to }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        include: { actor: { select: { id: true, username: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
