import { ApiProperty } from "@nestjs/swagger";
import { MinimumRequirementLevel } from "@pinus/shared";
import { IsDateString, IsEnum, IsNumber, Min } from "class-validator";

export class CreateMinimumRequirementDto {
  @ApiProperty({ enum: MinimumRequirementLevel })
  @IsEnum(MinimumRequirementLevel)
  level!: MinimumRequirementLevel;

  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @Min(0)
  minimumAmount!: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;
}
