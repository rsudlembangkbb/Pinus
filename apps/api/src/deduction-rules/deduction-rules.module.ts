import { Module } from "@nestjs/common";
import { DeductionRulesService } from "./deduction-rules.service";
import { DeductionRulesController } from "./deduction-rules.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [DeductionRulesService],
  controllers: [DeductionRulesController],
  exports: [DeductionRulesService],
})
export class DeductionRulesModule {}
