import { Module } from "@nestjs/common";
import { ImportService } from "./import.service";
import { ImportController } from "./import.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [ImportService],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
