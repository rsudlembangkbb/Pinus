import { ApiProperty, PartialType } from "@nestjs/swagger";
import { EmploymentStatus, MinimumRequirementLevel, StaffCategory } from "@pinus/shared";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateEmployeeDto {
  @ApiProperty({ example: "198501012010011001" })
  @IsString()
  @MinLength(3)
  nip!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ enum: StaffCategory })
  @IsEnum(StaffCategory)
  staffCategory!: StaffCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiProperty()
  @IsString()
  workUnitId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  jobGradeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({ enum: EmploymentStatus })
  @IsEnum(EmploymentStatus)
  employmentStatus!: EmploymentStatus;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, enum: MinimumRequirementLevel })
  @IsOptional()
  @IsEnum(MinimumRequirementLevel)
  minimumRequirementLevel?: MinimumRequirementLevel;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
