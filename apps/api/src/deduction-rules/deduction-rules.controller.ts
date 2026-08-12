import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, UserRole } from "@pinus/shared";
import { DeductionRulesService } from "./deduction-rules.service";
import { CreateDeductionRuleDto } from "./dto/deduction-rule.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("deduction-rules")
@ApiBearerAuth()
@Controller("deduction-rules")
export class DeductionRulesController {
  constructor(private readonly service: DeductionRulesService) {}

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
  create(@Body() dto: CreateDeductionRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }
}
