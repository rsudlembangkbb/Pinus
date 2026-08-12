import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, UserRole } from "@pinus/shared";
import { JobGradesService } from "./job-grades.service";
import { CreateJobGradeDto, UpdateJobGradeDto } from "./dto/job-grade.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("job-grades")
@ApiBearerAuth()
@Controller("job-grades")
export class JobGradesController {
  constructor(private readonly service: JobGradesService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  findAll(@Query("includeInactive") includeInactive?: string) {
    return this.service.findAll(includeInactive === "true");
  }

  @Get(":id")
  @RequirePermissions(Permission.MASTER_DATA_READ)
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  @RequirePermissions(Permission.MASTER_DATA_MANAGE)
  create(@Body() dto: CreateJobGradeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  @RequirePermissions(Permission.MASTER_DATA_MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateJobGradeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  @RequirePermissions(Permission.MASTER_DATA_MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.id);
  }
}
