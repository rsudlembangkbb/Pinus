import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, UserRole } from "@pinus/shared";
import { ProportionSchemesService } from "./proportion-schemes.service";
import { CreateProportionSchemeDto } from "./dto/proportion-scheme.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("proportion-schemes")
@ApiBearerAuth()
@Controller("proportion-schemes")
export class ProportionSchemesController {
  constructor(private readonly service: ProportionSchemesService) {}

  @Get()
  @RequirePermissions(Permission.MASTER_DATA_READ)
  findAll(@Query("workUnitId") workUnitId?: string, @Query("includeHistory") includeHistory?: string) {
    return this.service.findAll({ workUnitId, includeHistory: includeHistory === "true" });
  }

  @Get(":id")
  @RequirePermissions(Permission.MASTER_DATA_READ)
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  @RequirePermissions(Permission.MASTER_DATA_MANAGE)
  create(@Body() dto: CreateProportionSchemeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }
}
