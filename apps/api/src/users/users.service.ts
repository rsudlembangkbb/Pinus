import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const BCRYPT_ROUNDS = 12;

const SAFE_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  employeeId: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: { id: true, fullName: true, nip: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(params: { skip?: number; take?: number; search?: string }) {
    return this.prisma.user.findMany({
      where: params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" } },
              { username: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: SAFE_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take ?? 50,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException("Pengguna tidak ditemukan");
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException("Email atau username sudah digunakan");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        role: dto.role,
        employeeId: dto.employeeId,
        isActive: dto.isActive ?? true,
      },
      select: SAFE_SELECT,
    });

    await this.auditService.record({
      actorId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      after: user,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.findOne(id);

    const data: Record<string, unknown> = {
      email: dto.email,
      username: dto.username,
      role: dto.role,
      employeeId: dto.employeeId,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      data.passwordChangedAt = new Date();
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });

    await this.auditService.record({
      actorId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      before,
      after: user,
    });

    return user;
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    // Soft-delete via isActive: financial audit history references users,
    // so hard-deleting accounts would orphan approval_steps/audit_logs.
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: SAFE_SELECT,
    });
    await this.auditService.record({
      actorId,
      action: "DEACTIVATE",
      entityType: "User",
      entityId: id,
      before,
      after: user,
    });
    return user;
  }
}
