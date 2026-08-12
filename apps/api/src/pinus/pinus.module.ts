import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ReportsService } from '../reports/reports.service';
import { PinusController } from './pinus.controller';
import { PinusService } from './pinus.service';

@Module({
  imports: [CommonModule],
  controllers: [PinusController],
  providers: [PinusService, ReportsService],
})
export class PinusModule {}
