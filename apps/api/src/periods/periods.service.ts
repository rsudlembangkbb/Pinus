import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalDecision, ApprovalStage, PeriodStatus, UserRole } from "@pinus/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CalculationService } from "../calculation/calculation.service";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { DecideApprovalDto } from "./dto/decide-approval.dto";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";

const STAGE_ORDER: ApprovalStage[] = [
  ApprovalStage.UNIT_VERIFICATION,
  ApprovalStage.FINANCE_VERIFICATION,
  ApprovalStage.DIRECTOR_APPROVAL,
];

const STAGE_ROLE: Record<ApprovalStage, UserRole> = {
  [ApprovalStage.UNIT_VERIFICATION]: UserRole.VERIFIKATOR_UNIT,
  [ApprovalStage.FINANCE_VERIFICATION]: UserRole.KEUANGAN,
  [ApprovalStage.DIRECTOR_APPROVAL]: UserRole.DIREKTUR,
};

const STAGE_STATUS: Record<ApprovalStage, PeriodStatus> = {
  [ApprovalStage.UNIT_VERIFICATION]: PeriodStatus.UNIT_VERIFICATION,
  [ApprovalStage.FINANCE_VERIFICATION]: PeriodStatus.FINANCE_VERIFICATION,
  [ApprovalStage.DIRECTOR_APPROVAL]: PeriodStatus.DIRECTOR_APPROVAL,
};

@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly calculationService: CalculationService,
  ) {}

  findAll() {
    return this.prisma.calculationPeriod.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] });
  }

  async findOne(id: string) {
    const period = await this.prisma.calculationPeriod.findUnique({
      where: { id },
      include: {
        approvalSteps: {
          include: {
            workUnit: { select: { id: true, name: true } },
            actor: { select: { id: true, username: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!period) throw new NotFoundException("Periode tidak ditemukan");
    return period;
  }

  async create(dto: CreatePeriodDto, actorId: string) {
    const period = await this.prisma.calculationPeriod.create({
      data: {
        name: dto.name,
        year: dto.year,
        month: dto.month,
        performanceBudgetCap: dto.performanceBudgetCap,
        administrativeBudget: dto.administrativeBudget ?? 0,
        unitTeamFixedPortionPercent: dto.unitTeamFixedPortionPercent ?? 100,
        openedById: actorId,
        status: PeriodStatus.DRAFT,
      },
    });
    await this.auditService.record({
      actorId,
      action: "CREATE",
      entityType: "CalculationPeriod",
      entityId: period.id,
      after: period,
    });
    return period;
  }

  async calculate(id: string, actorId: string) {
    const period = await this.findOne(id);
    if (period.lockedAt) throw new BadRequestException("Periode sudah final/terkunci");
    return this.calculationService.runForPeriod(id, actorId);
  }

  /** CALCULATED -> UNIT_VERIFICATION: opens the maker-checker-approver chain. */
  async submitForVerification(id: string, actorId: string) {
    const period = await this.findOne(id);
    if (period.status !== PeriodStatus.CALCULATED) {
      throw new BadRequestException("Periode harus berstatus Terkalkulasi sebelum diajukan verifikasi");
    }

    const workUnits = await this.prisma.calculationResult.findMany({
      where: { periodId: id },
      distinct: ["employeeId"],
      select: { employee: { select: { workUnitId: true } } },
    });
    const workUnitIds = Array.from(new Set(workUnits.map((w) => w.employee.workUnitId)));

    await this.prisma.$transaction([
      this.prisma.approvalStep.deleteMany({ where: { periodId: id, decision: ApprovalDecision.PENDING } }),
      this.prisma.approvalStep.createMany({
        data: [
          ...workUnitIds.map((workUnitId) => ({
            periodId: id,
            workUnitId,
            stage: ApprovalStage.UNIT_VERIFICATION,
            decision: ApprovalDecision.PENDING,
          })),
          { periodId: id, stage: ApprovalStage.FINANCE_VERIFICATION, decision: ApprovalDecision.PENDING },
          { periodId: id, stage: ApprovalStage.DIRECTOR_APPROVAL, decision: ApprovalDecision.PENDING },
        ],
      }),
      this.prisma.calculationPeriod.update({
        where: { id },
        data: { status: PeriodStatus.UNIT_VERIFICATION },
      }),
    ]);

    await this.notificationsService.notifyRoles(
      [UserRole.VERIFIKATOR_UNIT],
      "Verifikasi Jaspel diperlukan",
      `Data periode ${period.name} menunggu verifikasi unit Anda.`,
    );

    await this.auditService.record({
      actorId,
      action: "SUBMIT_FOR_VERIFICATION",
      entityType: "CalculationPeriod",
      entityId: id,
    });

    return this.findOne(id);
  }

  async decideApproval(periodId: string, approvalStepId: string, dto: DecideApprovalDto, user: AuthenticatedUser) {
    const step = await this.prisma.approvalStep.findUnique({ where: { id: approvalStepId } });
    if (!step || step.periodId !== periodId) throw new NotFoundException("Tahapan approval tidak ditemukan");
    if (step.decision !== ApprovalDecision.PENDING) {
      throw new BadRequestException("Tahapan approval ini sudah diputuskan");
    }

    // Prisma's generated ApprovalStage enum is structurally identical to
    // @pinus/shared's but nominally distinct; normalize once here.
    const stage = step.stage as unknown as ApprovalStage;

    await this.assertCanDecide(stage, step.workUnitId, user);

    const period = await this.findOne(periodId);
    const currentStageIndex = STAGE_ORDER.indexOf(stage);
    if (STAGE_STATUS[stage] !== period.status) {
      throw new BadRequestException("Tahapan ini belum aktif pada alur periode saat ini");
    }

    await this.prisma.approvalStep.update({
      where: { id: approvalStepId },
      data: {
        decision: dto.decision,
        notes: dto.notes,
        actorId: user.id,
        decidedAt: new Date(),
      },
    });

    await this.auditService.record({
      actorId: user.id,
      action: dto.decision === ApprovalDecision.APPROVED ? "APPROVE" : "REJECT",
      entityType: "ApprovalStep",
      entityId: approvalStepId,
      after: { stage: step.stage, decision: dto.decision, notes: dto.notes },
    });

    if (dto.decision === ApprovalDecision.REJECTED) {
      await this.prisma.calculationPeriod.update({
        where: { id: periodId },
        data: { status: PeriodStatus.PROCESSING },
      });
      await this.notificationsService.notifyRoles(
        [UserRole.ADMIN_JASPEL, UserRole.SUPER_ADMIN],
        "Data Jaspel dikembalikan",
        `Periode ${period.name} dikembalikan pada tahap ${step.stage} untuk diperbaiki: ${dto.notes ?? "-"}`,
      );
      return this.findOne(periodId);
    }

    // Approved — check whether every step at this stage is now done, and advance.
    const remainingAtStage = await this.prisma.approvalStep.count({
      where: { periodId, stage: step.stage, decision: ApprovalDecision.PENDING },
    });

    if (remainingAtStage === 0) {
      const nextStage = STAGE_ORDER[currentStageIndex + 1];
      if (nextStage) {
        await this.prisma.calculationPeriod.update({
          where: { id: periodId },
          data: { status: STAGE_STATUS[nextStage] },
        });
        await this.notificationsService.notifyRoles(
          [STAGE_ROLE[nextStage]],
          "Verifikasi Jaspel diperlukan",
          `Data periode ${period.name} menunggu tahap ${nextStage}.`,
        );
      } else {
        await this.prisma.calculationPeriod.update({
          where: { id: periodId },
          data: { status: PeriodStatus.FINAL, lockedAt: new Date() },
        });
        await this.notificationsService.notifyRoles(
          [UserRole.ADMIN_JASPEL, UserRole.SUPER_ADMIN],
          "Periode siap dipublikasikan",
          `Periode ${period.name} telah disetujui penuh dan siap dipublikasikan.`,
        );
      }
    }

    return this.findOne(periodId);
  }

  async publish(id: string, actorId: string) {
    const period = await this.findOne(id);
    if (period.status !== PeriodStatus.FINAL) {
      throw new BadRequestException("Periode harus berstatus Final sebelum dipublikasikan");
    }

    await this.prisma.calculationPeriod.update({
      where: { id },
      data: { status: PeriodStatus.PUBLISHED },
    });

    const results = await this.prisma.calculationResult.findMany({
      where: { periodId: id },
      select: { employee: { select: { user: { select: { id: true } } } } },
    });
    const userIds = results.map((r) => r.employee.user?.id).filter((v): v is string => !!v);
    await this.notificationsService.notifyUsers(
      userIds,
      "Rincian Jaspel Anda telah terbit",
      `Rincian Jaspel periode ${period.name} sudah dapat dilihat pada dashboard Anda.`,
    );

    await this.auditService.record({
      actorId,
      action: "PUBLISH",
      entityType: "CalculationPeriod",
      entityId: id,
    });

    return this.findOne(id);
  }

  private async assertCanDecide(stage: ApprovalStage, workUnitId: string | null, user: AuthenticatedUser) {
    if (user.role === UserRole.SUPER_ADMIN) return;

    const requiredRole = STAGE_ROLE[stage];
    if (user.role !== requiredRole) {
      throw new ForbiddenException(`Tahapan ${stage} hanya dapat diputuskan oleh peran ${requiredRole}`);
    }

    if (stage === ApprovalStage.UNIT_VERIFICATION) {
      if (!user.employeeId) {
        throw new ForbiddenException("Akun verifikator harus terhubung ke data pegawai/unit kerja");
      }
      const employee = await this.prisma.employee.findUnique({ where: { id: user.employeeId } });
      if (!employee || employee.workUnitId !== workUnitId) {
        throw new ForbiddenException("Anda hanya dapat memverifikasi data unit kerja Anda sendiri");
      }
    }
  }
}
