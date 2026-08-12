import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto";

const INCLUDE = {
  workUnit: { select: { id: true, code: true, name: true } },
  jobGrade: { select: { id: true, code: true, name: true } },
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params: {
    workUnitId?: string;
    staffCategory?: string;
    search?: string;
    includeInactive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.EmployeeWhereInput = {
      workUnitId: params.workUnitId,
      staffCategory: params.staffCategory as never,
      isActive: params.includeInactive ? undefined : true,
      OR: params.search
        ? [
            { fullName: { contains: params.search, mode: "insensitive" } },
            { nip: { contains: params.search, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: INCLUDE,
        orderBy: { fullName: "asc" },
        skip: params.skip,
        take: params.take ?? 50,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: INCLUDE });
    if (!employee) throw new NotFoundException("Pegawai tidak ditemukan");
    return employee;
  }

  async create(dto: CreateEmployeeDto, actorId: string) {
    const existing = await this.prisma.employee.findUnique({ where: { nip: dto.nip } });
    if (existing) throw new ConflictException("NIP sudah terdaftar");

    const employee = await this.prisma.employee.create({
      data: { ...dto, startDate: new Date(dto.startDate) },
      include: INCLUDE,
    });
    await this.auditService.record({
      actorId,
      action: "CREATE",
      entityType: "Employee",
      entityId: employee.id,
      after: employee,
    });
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, actorId: string) {
    const before = await this.findOne(id);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { ...dto, startDate: dto.startDate ? new Date(dto.startDate) : undefined },
      include: INCLUDE,
    });
    await this.auditService.record({
      actorId,
      action: "UPDATE",
      entityType: "Employee",
      entityId: id,
      before,
      after: employee,
    });
    return employee;
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
      include: INCLUDE,
    });
    await this.auditService.record({
      actorId,
      action: "DEACTIVATE",
      entityType: "Employee",
      entityId: id,
      before,
      after: employee,
    });
    return employee;
  }
}
