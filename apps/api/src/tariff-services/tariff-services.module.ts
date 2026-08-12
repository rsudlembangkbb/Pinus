import { Module } from "@nestjs/common";
import { TariffServicesService } from "./tariff-services.service";
import { TariffServicesController } from "./tariff-services.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [TariffServicesService],
  controllers: [TariffServicesController],
  exports: [TariffServicesService],
})
export class TariffServicesModule {}
