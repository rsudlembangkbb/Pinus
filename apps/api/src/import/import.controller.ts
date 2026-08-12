import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { ImportBatchType, ImportRowStatus, Permission, UserRole } from "@pinus/shared";
import { ImportService } from "./import.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthenticatedUser } from "../common/decorators/current-user.decorator";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

@ApiTags("import")
@ApiBearerAuth()
@Controller("import")
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL)
@RequirePermissions(Permission.IMPORT_MANAGE)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get("template/:type")
  async downloadTemplate(
    @Param("type", new ParseEnumPipe(ImportBatchType)) type: ImportBatchType,
    @Res() res: Response,
  ) {
    const buffer = await this.importService.generateTemplate(type);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="template-${type.toLowerCase()}.xlsx"`);
    res.send(buffer);
  }

  @Post(":type/periods/:periodId/upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async upload(
    @Param("type", new ParseEnumPipe(ImportBatchType)) type: ImportBatchType,
    @Param("periodId") periodId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException("Berkas tidak ditemukan");
    return this.importService.upload(type, periodId, file, user.id);
  }

  @Get("periods/:periodId/batches")
  listBatches(@Param("periodId") periodId: string) {
    return this.importService.listBatches(periodId);
  }

  @Get("batches/:id")
  getBatch(@Param("id") id: string) {
    return this.importService.getBatch(id);
  }

  @Get("batches/:id/rows")
  getBatchRows(
    @Param("id") id: string,
    @Query("status") status?: ImportRowStatus,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.importService.getBatchRows(id, status, skip ? Number(skip) : 0, take ? Number(take) : 100);
  }

  @Post("batches/:id/commit")
  commit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importService.commit(id, user.id);
  }
}
