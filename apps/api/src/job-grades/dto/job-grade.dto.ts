import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateJobGradeDto {
  @ApiProperty({ example: "JG-3" })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: "Job Grade 3 - Perawat Mahir" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 1.25, description: "Bobot pengali distribusi Jaspel tim unit" })
  @IsNumber()
  @Min(0)
  weightScore!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateJobGradeDto extends PartialType(CreateJobGradeDto) {}
