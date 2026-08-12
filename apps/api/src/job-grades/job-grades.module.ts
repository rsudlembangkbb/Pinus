import { Module } from "@nestjs/common";
import { JobGradesService } from "./job-grades.service";
import { JobGradesController } from "./job-grades.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [JobGradesService],
  controllers: [JobGradesController],
  exports: [JobGradesService],
})
export class JobGradesModule {}
