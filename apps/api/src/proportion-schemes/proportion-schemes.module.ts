import { Module } from "@nestjs/common";
import { ProportionSchemesService } from "./proportion-schemes.service";
import { ProportionSchemesController } from "./proportion-schemes.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [ProportionSchemesService],
  controllers: [ProportionSchemesController],
  exports: [ProportionSchemesService],
})
export class ProportionSchemesModule {}
