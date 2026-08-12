import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateProportionSchemeDto } from "./dto/proportion-scheme.dto";

/**
 * proportion_schemes is versioned/time-bound (PRD §7 note): a new version
 * never overwrites an old one — it closes the previous open-ended row
 * (effectiveTo = day before the new effectiveFrom) and inserts a new row.
 * This guarantees calculation results for already-finalized periods keep
 * resolving to the parameters that were actually in force at the time.
 */
@Injectable()
export class ProportionSchemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(params: { workUnitId?: string; includeHistory?: boolean }) {
    return this.prisma.proportionScheme.findMany({
      where: {
        workUnitId: params.workUnitId,
        effectiveTo: params.includeHistory ? undefined : null,
      },
      include: { workUnit: { select: { id: true, code: true, name: true } } },
      orderBy: [{ workUnitId: "asc" }, { guaranteeStatus: "asc" }, { serviceRole: "asc" }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.proportionScheme.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Skema proporsi tidak ditemukan");
    return item;
  }

  /** Resolves the percentage in force for a given work unit/status/role at a point in time. */
  async findEffective(
    workUnitId: string,
    guaranteeStatus: string,
    serviceRole: string,
    at: Date,
  ) {
    return this.prisma.proportionScheme.findFirst({
      where: {
        workUnitId,
        guaranteeStatus: guaranteeStatus as never,
        serviceRole: serviceRole as never,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async create(dto: CreateProportionSchemeDto, actorId: string) {
    const effectiveFrom = new Date(dto.effectiveFrom);

    const created = await this.prisma.$transaction(async (tx) => {
      const openEnded = await tx.proportionScheme.findFirst({
        where: {
          workUnitId: dto.workUnitId,
          guaranteeStatus: dto.guaranteeStatus,
          serviceRole: dto.serviceRole,
          effectiveTo: null,
        },
      });

      if (openEnded) {
        const dayBefore = new Date(effectiveFrom);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await tx.proportionScheme.update({
          where: { id: openEnded.id },
          data: { effectiveTo: dayBefore },
        });
      }

      return tx.proportionScheme.create({
        data: {
          workUnitId: dto.workUnitId,
          guaranteeStatus: dto.guaranteeStatus,
          serviceRole: dto.serviceRole,
          percentage: dto.percentage,
          effectiveFrom,
          notes: dto.notes,
          createdById: actorId,
        },
      });
    });

    await this.auditService.record({
      actorId,
      action: "CREATE_VERSION",
      entityType: "ProportionScheme",
      entityId: created.id,
      after: created,
    });

    return created;
  }
}
