import { Module } from '@nestjs/common';
import { RolesGuard } from './auth';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService, AuditService, RolesGuard],
  exports: [PrismaService, AuditService, RolesGuard],
})
export class CommonModule {}
