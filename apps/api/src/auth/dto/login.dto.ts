import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@rsudlembang.go.id" })
  @IsString()
  identifier!: string; // email or username

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}
