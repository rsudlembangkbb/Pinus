import { Module } from "@nestjs/common";
import { MinimumRequirementsService } from "./minimum-requirements.service";
import { MinimumRequirementsController } from "./minimum-requirements.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [MinimumRequirementsService],
  controllers: [MinimumRequirementsController],
  exports: [MinimumRequirementsService],
})
export class MinimumRequirementsModule {}
