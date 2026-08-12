import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(login: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
        isActive: true,
      },
      include: {
        employee: true,
        workUnit: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Akun tidak ditemukan.');
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Password tidak valid.');
    }

    return user;
  }

  async login(user: User) {
    const payload = {
      sub: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.log({
      actorId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      after: { username: user.username, email: user.email },
    });

    return { accessToken };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        employee: {
          include: {
            workUnit: true,
            jobGrade: true,
          },
        },
        workUnit: true,
      },
    });
  }
}
