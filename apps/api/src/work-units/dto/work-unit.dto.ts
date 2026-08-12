import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateWorkUnitDto {
  @ApiProperty({ example: "IGD" })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: "Instalasi Gawat Darurat" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "igd" })
  @IsString()
  serviceCategory!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWorkUnitDto extends PartialType(CreateWorkUnitDto) {}
