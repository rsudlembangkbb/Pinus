import { Module } from "@nestjs/common";
import { CalculationService } from "./calculation.service";
import { CalculationController } from "./calculation.controller";
import { AuditModule } from "../audit/audit.module";
import { ProportionSchemesModule } from "../proportion-schemes/proportion-schemes.module";
import { DeductionRulesModule } from "../deduction-rules/deduction-rules.module";
import { MinimumRequirementsModule } from "../minimum-requirements/minimum-requirements.module";
import { IndexingWeightsModule } from "../indexing-weights/indexing-weights.module";

@Module({
  imports: [
    AuditModule,
    ProportionSchemesModule,
    DeductionRulesModule,
    MinimumRequirementsModule,
    IndexingWeightsModule,
  ],
  providers: [CalculationService],
  controllers: [CalculationController],
  exports: [CalculationService],
})
export class CalculationModule {}
