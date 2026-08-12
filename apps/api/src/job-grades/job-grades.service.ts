import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateJobGradeDto, UpdateJobGradeDto } from "./dto/job-grade.dto";

@Injectable()
export class JobGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(includeInactive = false) {
    return this.prisma.jobGrade.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.jobGrade.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Job grade tidak ditemukan");
    return item;
  }

  async create(dto: CreateJobGradeDto, actorId: string) {
    const existing = await this.prisma.jobGrade.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("Kode job grade sudah digunakan");
    const item = await this.prisma.jobGrade.create({ data: dto });
    await this.auditService.record({ actorId, action: "CREATE", entityType: "JobGrade", entityId: item.id, after: item });
    return item;
  }

  async update(id: string, dto: UpdateJobGradeDto, actorId: string) {
    const before = await this.findOne(id);
    const item = await this.prisma.jobGrade.update({ where: { id }, data: dto });
    await this.auditService.record({ actorId, action: "UPDATE", entityType: "JobGrade", entityId: id, before, after: item });
    return item;
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    const item = await this.prisma.jobGrade.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({ actorId, action: "DEACTIVATE", entityType: "JobGrade", entityId: id, before, after: item });
    return item;
  }
}
