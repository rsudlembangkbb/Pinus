import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateIndexingWeightDto } from "./dto/indexing-weight.dto";

@Injectable()
export class IndexingWeightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(includeHistory = false) {
    return this.prisma.indexingWeight.findMany({
      where: includeHistory ? undefined : { effectiveTo: null },
      orderBy: { variableCode: "asc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.indexingWeight.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Bobot indeksing tidak ditemukan");
    return item;
  }

  /** All variable weights effective at the given date — used by the admin/structural engine. */
  async findEffectiveAll(at: Date) {
    return this.prisma.indexingWeight.findMany({
      where: {
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
    });
  }

  async create(dto: CreateIndexingWeightDto, actorId: string) {
    const effectiveFrom = new Date(dto.effectiveFrom);

    const created = await this.prisma.$transaction(async (tx) => {
      const openEnded = await tx.indexingWeight.findFirst({
        where: { variableCode: dto.variableCode, effectiveTo: null },
      });
      if (openEnded) {
        const dayBefore = new Date(effectiveFrom);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await tx.indexingWeight.update({ where: { id: openEnded.id }, data: { effectiveTo: dayBefore } });
      }
      return tx.indexingWeight.create({
        data: {
          variableCode: dto.variableCode,
          variableLabel: dto.variableLabel,
          weightPercent: dto.weightPercent,
          effectiveFrom,
        },
      });
    });

    await this.auditService.record({
      actorId,
      action: "CREATE_VERSION",
      entityType: "IndexingWeight",
      entityId: created.id,
      after: created,
    });

    return created;
  }
}
