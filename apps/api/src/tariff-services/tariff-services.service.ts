import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateTariffServiceDto, UpdateTariffServiceDto } from "./dto/tariff-service.dto";

@Injectable()
export class TariffServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(workUnitId?: string) {
    return this.prisma.tariffService.findMany({
      where: { workUnitId },
      include: { workUnit: { select: { id: true, code: true, name: true } } },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.tariffService.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Referensi tarif layanan tidak ditemukan");
    return item;
  }

  async create(dto: CreateTariffServiceDto, actorId: string) {
    const existing = await this.prisma.tariffService.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("Kode tarif layanan sudah digunakan");
    const item = await this.prisma.tariffService.create({
      data: { ...dto, effectiveFrom: new Date(dto.effectiveFrom) },
    });
    await this.auditService.record({ actorId, action: "CREATE", entityType: "TariffService", entityId: item.id, after: item });
    return item;
  }

  async update(id: string, dto: UpdateTariffServiceDto, actorId: string) {
    const before = await this.findOne(id);
    const item = await this.prisma.tariffService.update({
      where: { id },
      data: { ...dto, effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined },
    });
    await this.auditService.record({ actorId, action: "UPDATE", entityType: "TariffService", entityId: id, before, after: item });
    return item;
  }
}
