import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApprovalLevel,
  ApprovalStatus,
  EmployeeCategory,
  Role,
} from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from '../common/auth';
import { PinusService } from './pinus.service';

const workUnitSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  serviceType: z.string().min(2),
});

const jobGradeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  weight: z.coerce.number().positive(),
});

const employeeSchema = z.object({
  employeeNumber: z.string().min(3),
  nationalId: z.string().optional(),
  fullName: z.string().min(3),
  category: z.nativeEnum(EmployeeCategory),
  profession: z.string().optional(),
  specialization: z.string().optional(),
  position: z.string().optional(),
  employmentStatus: z.enum(['PNS', 'PPPK', 'NON_ASN']),
  startDate: z.string(),
  minimumGuarantee: z.coerce.number().optional(),
  workUnitId: z.string().uuid(),
  jobGradeId: z.string().uuid().optional(),
});

const periodSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2025),
  budgetCap: z.coerce.number().positive(),
  healthcarePool: z.coerce.number().nonnegative(),
  administrativePool: z.coerce.number().nonnegative(),
});

const schemeSchema = z.object({
  workUnitId: z.string().uuid(),
  name: z.string().min(3),
  serviceType: z.string().min(2),
  roleInService: z.string().min(2),
  payerType: z.enum(['JKN', 'NON_JKN']),
  percentage: z.coerce.number().positive(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

const deductionRuleSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  description: z.string().min(3),
  percentage: z.coerce.number().min(0).max(100),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

const attendanceSchema = z.array(
  z.object({
    employeeId: z.string().uuid(),
    attendanceScore: z.coerce.number().min(0).max(100),
    leaveDays: z.coerce.number().min(0),
    disciplinaryAction: z.coerce.boolean(),
    trainingMonths: z.coerce.number().min(0),
    studyDaysPerWeek: z.coerce.number().min(0),
  }),
);

const performanceSchema = z.array(
  z.object({
    employeeId: z.string().uuid(),
    attendanceWeight: z.coerce.number().min(0).max(100),
    qualityWeight: z.coerce.number().min(0).max(100),
  }),
);

const approvalSchema = z.object({
  status: z.nativeEnum(ApprovalStatus),
  note: z.string().optional(),
});

@Controller('pinus')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PinusController {
  constructor(private readonly pinusService: PinusService) {}

  @Get('bootstrap')
  getBootstrap(@CurrentUser() user: AuthenticatedUser) {
    return this.pinusService.getBootstrap(user);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.pinusService.getDashboardSummary(user);
  }

  @Get('work-units')
  listWorkUnits() {
    return this.pinusService.listWorkUnits();
  }

  @Post('work-units')
  createWorkUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.pinusService.createWorkUnit(user, workUnitSchema.parse(body));
  }

  @Get('job-grades')
  listJobGrades() {
    return this.pinusService.listJobGrades();
  }

  @Post('job-grades')
  createJobGrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.pinusService.createJobGrade(user, jobGradeSchema.parse(body));
  }

  @Get('employees')
  listEmployees() {
    return this.pinusService.listEmployees();
  }

  @Post('employees')
  createEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.pinusService.createEmployee(user, employeeSchema.parse(body));
  }

  @Get('schemes')
  listSchemes() {
    return this.pinusService.listSchemes();
  }

  @Post('schemes')
  createScheme(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.pinusService.createScheme(user, schemeSchema.parse(body));
  }

  @Get('deduction-rules')
  listDeductionRules() {
    return this.pinusService.listDeductionRules();
  }

  @Post('deduction-rules')
  createDeductionRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.pinusService.createDeductionRule(
      user,
      deductionRuleSchema.parse(body),
    );
  }

  @Get('periods')
  listPeriods() {
    return this.pinusService.listPeriods();
  }

  @Post('periods')
  createPeriod(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.pinusService.createPeriod(user, periodSchema.parse(body));
  }

  @Get('periods/:periodId/results')
  getPeriodResults(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pinusService.getPeriodResults(periodId, user);
  }

  @Post('periods/:periodId/attendance')
  upsertAttendance(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.pinusService.upsertAttendance(
      user,
      periodId,
      attendanceSchema.parse(body),
    );
  }

  @Post('periods/:periodId/performance')
  upsertPerformance(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.pinusService.upsertPerformance(
      user,
      periodId,
      performanceSchema.parse(body),
    );
  }

  @Post('periods/:periodId/import-transactions')
  @UseInterceptors(FileInterceptor('file'))
  importTransactions(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.pinusService.importServiceTransactions(user, periodId, file);
  }

  @Post('periods/:periodId/calculate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_JASPEL)
  calculatePeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pinusService.calculatePeriod(periodId, user);
  }

  @Post('periods/:periodId/approve/:level')
  approve(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Param('level') level: ApprovalLevel,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const payload = approvalSchema.parse(body);
    return this.pinusService.submitApproval(
      periodId,
      level,
      payload.status,
      payload.note,
      user,
    );
  }

  @Get('me/slips')
  getMySlips(@CurrentUser() user: AuthenticatedUser) {
    return this.pinusService.getMySlips(user);
  }

  @Get('me/slips/:periodId/pdf')
  async downloadMySlip(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const buffer = await this.pinusService.downloadSlip(periodId, user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="slip-${periodId}.pdf"`,
    );
    response.send(buffer);
  }

  @Get('periods/:periodId/export.xlsx')
  async exportPeriodWorkbook(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const buffer = await this.pinusService.exportPeriodWorkbook(periodId, user);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="rekap-${periodId}.xlsx"`,
    );
    response.send(buffer);
  }

  @Get('audit-logs')
  getAuditLogs(@CurrentUser() user: AuthenticatedUser) {
    return this.pinusService.getAuditLogs(user);
  }
}
