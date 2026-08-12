import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Permission, UserRole } from "@pinus/shared";
import { PeriodsService } from "./periods.service";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { DecideApprovalDto } from "./dto/decide-approval.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

@ApiTags("periods")
@ApiBearerAuth()
@Controller("periods")
export class PeriodsController {
  constructor(private readonly service: PeriodsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  create(@Body() dto: CreatePeriodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @Post(":id/calculate")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  @RequirePermissions(Permission.CALCULATION_RUN)
  calculate(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.calculate(id, user.id);
  }

  @Post(":id/submit-for-verification")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  submitForVerification(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submitForVerification(id, user.id);
  }

  @Post(":id/approvals/:approvalStepId/decide")
  @Roles(UserRole.SUPER_ADMIN, UserRole.VERIFIKATOR_UNIT, UserRole.KEUANGAN, UserRole.DIREKTUR)
  decideApproval(
    @Param("id") id: string,
    @Param("approvalStepId") approvalStepId: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.decideApproval(id, approvalStepId, dto, user);
  }

  @Post(":id/publish")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
  publish(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.publish(id, user.id);
  }
}
