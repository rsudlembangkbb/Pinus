import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { AppController } from "./app.controller";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AuditModule } from "./audit/audit.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { WorkUnitsModule } from "./work-units/work-units.module";
import { JobGradesModule } from "./job-grades/job-grades.module";
import { EmployeesModule } from "./employees/employees.module";
import { ProportionSchemesModule } from "./proportion-schemes/proportion-schemes.module";
import { DeductionRulesModule } from "./deduction-rules/deduction-rules.module";
import { TariffServicesModule } from "./tariff-services/tariff-services.module";
import { MinimumRequirementsModule } from "./minimum-requirements/minimum-requirements.module";
import { IndexingWeightsModule } from "./indexing-weights/indexing-weights.module";
import { ImportModule } from "./import/import.module";
import { CalculationModule } from "./calculation/calculation.module";
import { PeriodsModule } from "./periods/periods.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    StorageModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    WorkUnitsModule,
    JobGradesModule,
    EmployeesModule,
    ProportionSchemesModule,
    DeductionRulesModule,
    TariffServicesModule,
    MinimumRequirementsModule,
    IndexingWeightsModule,
    ImportModule,
    CalculationModule,
    PeriodsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
