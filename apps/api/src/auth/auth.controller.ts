import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { CurrentUser, JwtAuthGuard } from '../common/auth';

const loginSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(6),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { login: string; password: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = loginSchema.parse(body);
    const user = await this.authService.validateUser(data.login, data.password);
    const session = await this.authService.login(user);

    response.cookie('pinus_access_token', session.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get('COOKIE_SECURE') === 'true',
      maxAge: 1000 * 60 * 60 * 12,
    });

    return {
      message: 'Login berhasil.',
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        workUnitId: user.workUnitId,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('pinus_access_token');
    return { message: 'Logout berhasil.' };
  }
}
