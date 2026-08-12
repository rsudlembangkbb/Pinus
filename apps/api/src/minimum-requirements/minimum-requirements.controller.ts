import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, UserRole } from "@pinus/shared";
import { MinimumRequirementsService } from "./minimum-requirements.service";
import { CreateMinimumRequirementDto } from "./dto/minimum-requirement.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("minimum-requirements")
@ApiBearerAuth()
@Controller("minimum-requirements")
export class MinimumRequirementsController {
  constructor(private readonly service: MinimumRequirementsService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  findAll(@Query("includeHistory") includeHistory?: string) {
    return this.service.findAll(includeHistory === "true");
  }

  @Get(":id")
  @RequirePermissions(Permission.MASTER_DATA_READ)
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  @RequirePermissions(Permission.MASTER_DATA_MANAGE)
  create(@Body() dto: CreateMinimumRequirementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }
}
