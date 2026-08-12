import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

function requestMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateCredentials(
      dto.identifier,
      dto.password,
      requestMeta(req),
    );
    const tokens = await this.authService.issueTokens(user, requestMeta(req));
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        employeeId: user.employeeId,
      },
    };
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refreshTokens(dto.refreshToken, requestMeta(req));
  }

  @Post("logout")
  async logout(@Body() dto: RefreshDto) {
    await this.authService.revokeRefreshToken(dto.refreshToken);
    return { success: true };
  }

  @Post("change-password")
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { success: true };
  }

  @ApiBearerAuth()
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        employeeId: true,
        lastLoginAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            nip: true,
            staffCategory: true,
            workUnit: { select: { id: true, name: true } },
          },
        },
      },
    });
    return full;
  }
}
