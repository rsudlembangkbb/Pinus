import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(10)
  password?: string;
}
