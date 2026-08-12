import { Module } from "@nestjs/common";
import { WorkUnitsService } from "./work-units.service";
import { WorkUnitsController } from "./work-units.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [WorkUnitsService],
  controllers: [WorkUnitsController],
  exports: [WorkUnitsService],
})
export class WorkUnitsModule {}
