import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsNumber, IsString, Max, Min, MinLength } from "class-validator";

export class CreatePeriodDto {
  @ApiProperty({ example: "Agustus 2026" })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  year!: number;

  @ApiProperty({ example: 8, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ required: false, description: "Pagu insentif kinerja untuk periode ini" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  performanceBudgetCap?: number;

  @ApiProperty({ required: false, description: "Alokasi insentif kinerja tenaga administrasi/struktural" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  administrativeBudget?: number;

  @ApiProperty({
    required: false,
    default: 100,
    description: "% pool tim unit yang tetap didistribusikan di unit yang sama; sisanya masuk subsidi lintas-unit",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  unitTeamFixedPortionPercent?: number;
}
