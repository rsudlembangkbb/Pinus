import { ApiProperty } from "@nestjs/swagger";
import { ServiceGuaranteeStatus, ServiceRole } from "@pinus/shared";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateProportionSchemeDto {
  @ApiProperty()
  @IsString()
  workUnitId!: string;

  @ApiProperty({ enum: ServiceGuaranteeStatus })
  @IsEnum(ServiceGuaranteeStatus)
  guaranteeStatus!: ServiceGuaranteeStatus;

  @ApiProperty({ enum: ServiceRole })
  @IsEnum(ServiceRole)
  serviceRole!: ServiceRole;

  @ApiProperty({ example: 12.5, description: "Persentase proporsi (0-100)" })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
