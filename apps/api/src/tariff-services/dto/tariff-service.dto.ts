import { ApiProperty, PartialType } from "@nestjs/swagger";
import { ServiceGuaranteeStatus } from "@pinus/shared";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateTariffServiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  workUnitId?: string;

  @ApiProperty({ enum: ServiceGuaranteeStatus })
  @IsEnum(ServiceGuaranteeStatus)
  guaranteeStatus!: ServiceGuaranteeStatus;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  tariffAmount!: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;
}

export class UpdateTariffServiceDto extends PartialType(CreateTariffServiceDto) {}
