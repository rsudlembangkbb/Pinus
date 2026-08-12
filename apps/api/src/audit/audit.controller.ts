import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, UserRole } from "@pinus/shared";
import { AuditService } from "./audit.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit-logs")
@Roles(UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.ADMIN_JASPEL)
@RequirePermissions(Permission.AUDIT_READ)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("actorId") actorId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.auditService.findAll({
      entityType,
      entityId,
      actorId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
