import { Controller, ForbiddenException, Get, Param, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { Permission, UserRole } from "@pinus/shared";
import { ReportsService } from "./reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("periods/:periodId/slip/:employeeId")
  async slip(
    @Param("periodId") periodId: string,
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    if (user.role === UserRole.PEGAWAI && user.employeeId !== employeeId) {
      throw new ForbiddenException("Anda hanya dapat mengunduh slip Anda sendiri");
    }
    const buffer = await this.reportsService.generateSlipPdf(periodId, employeeId, user.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="slip-jaspel-${employeeId}.pdf"`);
    res.send(buffer);
  }

  @Get("periods/:periodId/slips-batch")
  @RequirePermissions(Permission.REPORTS_READ)
  async slipsBatch(
    @Param("periodId") periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateBatchSlipsZip(periodId, user.id);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="slip-jaspel-batch-${periodId}.zip"`);
    res.send(buffer);
  }

  @Get("periods/:periodId/unit-recap")
  async unitRecap(
    @Param("periodId") periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query("workUnitId") workUnitId?: string,
  ) {
    let effectiveWorkUnitId = workUnitId;
    if (user.role === UserRole.VERIFIKATOR_UNIT) {
      const employee = user.employeeId
        ? await this.prisma.employee.findUnique({ where: { id: user.employeeId } })
        : null;
      if (!employee) throw new ForbiddenException("Akun tidak terhubung ke data pegawai/unit kerja");
      effectiveWorkUnitId = employee.workUnitId;
    } else if (
      ![UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL, UserRole.KEUANGAN, UserRole.DIREKTUR, UserRole.AUDITOR].includes(
        user.role,
      )
    ) {
      throw new ForbiddenException("Anda tidak memiliki akses ke laporan ini");
    }

    const buffer = await this.reportsService.generateUnitRecapExcel(periodId, user.id, effectiveWorkUnitId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="rekap-unit-${periodId}.xlsx"`);
    res.send(buffer);
  }

  @Get("periods/:periodId/raw-data")
  @RequirePermissions(Permission.REPORTS_READ)
  async rawData(@Param("periodId") periodId: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const buffer = await this.reportsService.generateRawDataExport(periodId, user.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="data-mentah-${periodId}.xlsx"`);
    res.send(buffer);
  }
}
