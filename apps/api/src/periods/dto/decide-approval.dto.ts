import { ApiProperty } from "@nestjs/swagger";
import { ApprovalDecision } from "@pinus/shared";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";

export class DecideApprovalDto {
  @ApiProperty({ enum: [ApprovalDecision.APPROVED, ApprovalDecision.REJECTED] })
  @IsIn([ApprovalDecision.APPROVED, ApprovalDecision.REJECTED])
  decision!: ApprovalDecision.APPROVED | ApprovalDecision.REJECTED;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
