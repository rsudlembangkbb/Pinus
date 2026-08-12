import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateWorkUnitDto, UpdateWorkUnitDto } from "./dto/work-unit.dto";

@Injectable()
export class WorkUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(includeInactive = false) {
    return this.prisma.workUnit.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const unit = await this.prisma.workUnit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException("Unit kerja tidak ditemukan");
    return unit;
  }

  async create(dto: CreateWorkUnitDto, actorId: string) {
    const existing = await this.prisma.workUnit.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("Kode unit kerja sudah digunakan");

    const unit = await this.prisma.workUnit.create({ data: dto });
    await this.auditService.record({
      actorId,
      action: "CREATE",
      entityType: "WorkUnit",
      entityId: unit.id,
      after: unit,
    });
    return unit;
  }

  async update(id: string, dto: UpdateWorkUnitDto, actorId: string) {
    const before = await this.findOne(id);
    const unit = await this.prisma.workUnit.update({ where: { id }, data: dto });
    await this.auditService.record({
      actorId,
      action: "UPDATE",
      entityType: "WorkUnit",
      entityId: id,
      before,
      after: unit,
    });
    return unit;
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    const unit = await this.prisma.workUnit.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({
      actorId,
      action: "DEACTIVATE",
      entityType: "WorkUnit",
      entityId: id,
      before,
      after: unit,
    });
    return unit;
  }
}
