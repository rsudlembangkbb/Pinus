import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, IsNumber, IsString, Max, Min, MinLength } from "class-validator";

export const INDEXING_VARIABLE_CODES = [
  "EXPERIENCE",
  "SKILL",
  "RISK",
  "URGENCY",
  "POSITION",
  "PERFORMANCE",
] as const;

export class CreateIndexingWeightDto {
  @ApiProperty({ enum: INDEXING_VARIABLE_CODES })
  @IsIn(INDEXING_VARIABLE_CODES)
  variableCode!: (typeof INDEXING_VARIABLE_CODES)[number];

  @ApiProperty({ example: "Pengalaman & Masa Kerja" })
  @IsString()
  @MinLength(2)
  variableLabel!: string;

  @ApiProperty({ example: 20, description: "Bobot persentase variabel (jumlah seluruh variabel = 100)" })
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent!: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;
}
