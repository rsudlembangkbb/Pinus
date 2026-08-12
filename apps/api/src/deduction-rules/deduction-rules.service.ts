import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateDeductionRuleDto } from "./dto/deduction-rule.dto";

@Injectable()
export class DeductionRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(includeHistory = false) {
    return this.prisma.deductionRule.findMany({
      where: includeHistory ? undefined : { effectiveTo: null },
      orderBy: { trigger: "asc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.deductionRule.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Aturan pengurangan tidak ditemukan");
    return item;
  }

  /** All deduction rules effective at the given date — used by the calculation engine. */
  async findAllEffective(at: Date) {
    return this.prisma.deductionRule.findMany({
      where: {
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
    });
  }

  async findEffective(trigger: string, at: Date) {
    return this.prisma.deductionRule.findFirst({
      where: {
        trigger: trigger as never,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async create(dto: CreateDeductionRuleDto, actorId: string) {
    const effectiveFrom = new Date(dto.effectiveFrom);

    const created = await this.prisma.$transaction(async (tx) => {
      const openEnded = await tx.deductionRule.findFirst({
        where: { trigger: dto.trigger, effectiveTo: null },
      });
      if (openEnded) {
        const dayBefore = new Date(effectiveFrom);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await tx.deductionRule.update({ where: { id: openEnded.id }, data: { effectiveTo: dayBefore } });
      }
      return tx.deductionRule.create({
        data: {
          trigger: dto.trigger,
          description: dto.description,
          percentage: dto.percentage,
          effectiveFrom,
        },
      });
    });

    await this.auditService.record({
      actorId,
      action: "CREATE_VERSION",
      entityType: "DeductionRule",
      entityId: created.id,
      after: created,
    });

    return created;
  }
}
