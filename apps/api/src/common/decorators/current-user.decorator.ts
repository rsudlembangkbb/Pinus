import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserRole } from "@pinus/shared";

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  employeeId: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
