import { Module } from "@nestjs/common";
import { PeriodsService } from "./periods.service";
import { PeriodsController } from "./periods.controller";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CalculationModule } from "../calculation/calculation.module";

@Module({
  imports: [AuditModule, NotificationsModule, CalculationModule],
  providers: [PeriodsService],
  controllers: [PeriodsController],
  exports: [PeriodsService],
})
export class PeriodsModule {}
