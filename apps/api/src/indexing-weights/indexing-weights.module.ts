import { Module } from "@nestjs/common";
import { IndexingWeightsService } from "./indexing-weights.service";
import { IndexingWeightsController } from "./indexing-weights.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [IndexingWeightsService],
  controllers: [IndexingWeightsController],
  exports: [IndexingWeightsService],
})
export class IndexingWeightsModule {}
