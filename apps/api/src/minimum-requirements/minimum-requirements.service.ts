import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateMinimumRequirementDto } from "./dto/minimum-requirement.dto";

@Injectable()
export class MinimumRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(includeHistory = false) {
    return this.prisma.minimumRequirement.findMany({
      where: includeHistory ? undefined : { effectiveTo: null },
      orderBy: { level: "asc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.minimumRequirement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Ketentuan minimum requirement tidak ditemukan");
    return item;
  }

  /** All minimum requirements effective at the given date — used by the calculation engine. */
  async findAllEffective(at: Date) {
    return this.prisma.minimumRequirement.findMany({
      where: {
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
    });
  }

  async findEffective(level: string, at: Date) {
    return this.prisma.minimumRequirement.findFirst({
      where: {
        level: level as never,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async create(dto: CreateMinimumRequirementDto, actorId: string) {
    const effectiveFrom = new Date(dto.effectiveFrom);

    const created = await this.prisma.$transaction(async (tx) => {
      const openEnded = await tx.minimumRequirement.findFirst({
        where: { level: dto.level, effectiveTo: null },
      });
      if (openEnded) {
        const dayBefore = new Date(effectiveFrom);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await tx.minimumRequirement.update({ where: { id: openEnded.id }, data: { effectiveTo: dayBefore } });
      }
      return tx.minimumRequirement.create({
        data: { level: dto.level, minimumAmount: dto.minimumAmount, effectiveFrom },
      });
    });

    await this.auditService.record({
      actorId,
      action: "CREATE_VERSION",
      entityType: "MinimumRequirement",
      entityId: created.id,
      after: created,
    });

    return created;
  }
}
