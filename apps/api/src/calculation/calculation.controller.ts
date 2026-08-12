import { Controller, ForbiddenException, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, PeriodStatus, UserRole } from "@pinus/shared";
import { CalculationService } from "./calculation.service";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("calculation")
@ApiBearerAuth()
@Controller("periods/:periodId/results")
export class CalculationController {
  constructor(
    private readonly calculationService: CalculationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(
    @Param("periodId") periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query("workUnitId") workUnitId?: string,
    @Query("staffCategory") staffCategory?: string,
  ) {
    if (user.role === UserRole.VERIFIKATOR_UNIT) {
      const employee = user.employeeId
        ? await this.prisma.employee.findUnique({ where: { id: user.employeeId } })
        : null;
      if (!employee) throw new ForbiddenException("Akun tidak terhubung ke data pegawai/unit kerja");
      return this.calculationService.findResultsForPeriod(periodId, {
        workUnitId: employee.workUnitId,
        staffCategory,
      });
    }

    if (
      ![UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL, UserRole.KEUANGAN, UserRole.DIREKTUR, UserRole.AUDITOR].includes(
        user.role,
      )
    ) {
      throw new ForbiddenException("Anda tidak memiliki akses ke rekap hasil kalkulasi ini");
    }

    return this.calculationService.findResultsForPeriod(periodId, { workUnitId, staffCategory });
  }

  @Get("me")
  @RequirePermissions(Permission.CALCULATION_READ_OWN)
  async findMine(@Param("periodId") periodId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException("Akun Anda tidak terhubung ke data pegawai");
    const period = await this.prisma.calculationPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Periode tidak ditemukan");
    if (period.status !== PeriodStatus.PUBLISHED && user.role === UserRole.PEGAWAI) {
      throw new ForbiddenException("Rincian Jaspel periode ini belum dipublikasikan");
    }
    const result = await this.calculationService.findResultForEmployee(periodId, user.employeeId);
    if (!result) throw new NotFoundException("Belum ada hasil kalkulasi untuk Anda pada periode ini");
    return result;
  }

  @Get(":employeeId")
  async findOne(
    @Param("periodId") periodId: string,
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.PEGAWAI) {
      if (user.employeeId !== employeeId) {
        throw new ForbiddenException("Anda hanya dapat melihat data Jaspel milik Anda sendiri");
      }
      const period = await this.prisma.calculationPeriod.findUnique({ where: { id: periodId } });
      if (period?.status !== PeriodStatus.PUBLISHED) {
        throw new ForbiddenException("Rincian Jaspel periode ini belum dipublikasikan");
      }
    } else if (user.role === UserRole.VERIFIKATOR_UNIT) {
      const [actor, target] = await Promise.all([
        this.prisma.employee.findUnique({ where: { id: user.employeeId ?? "" } }),
        this.prisma.employee.findUnique({ where: { id: employeeId } }),
      ]);
      if (!actor || !target || actor.workUnitId !== target.workUnitId) {
        throw new ForbiddenException("Anda hanya dapat melihat data pegawai unit kerja Anda");
      }
    }

    const result = await this.calculationService.findResultForEmployee(periodId, employeeId);
    if (!result) throw new NotFoundException("Hasil kalkulasi tidak ditemukan");
    return result;
  }
}
