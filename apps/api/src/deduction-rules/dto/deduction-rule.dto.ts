import { ApiProperty } from "@nestjs/swagger";
import { DeductionTrigger } from "@pinus/shared";
import { IsDateString, IsEnum, IsNumber, IsString, Max, Min, MinLength } from "class-validator";

export class CreateDeductionRuleDto {
  @ApiProperty({ enum: DeductionTrigger })
  @IsEnum(DeductionTrigger)
  trigger!: DeductionTrigger;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  description!: string;

  @ApiProperty({ example: 50, description: "Persentase pengurangan (0-100)" })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;
}
