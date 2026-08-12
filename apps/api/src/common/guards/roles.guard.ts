import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permission, roleHasPermission, UserRole } from "@pinus/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthenticatedUser } from "../decorators/current-user.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException("Tidak terautentikasi");

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Peran Anda tidak memiliki akses ke sumber daya ini");
    }

    if (requiredPermissions?.length) {
      const missing = requiredPermissions.filter((p) => !roleHasPermission(user.role, p));
      if (missing.length > 0) {
        throw new ForbiddenException("Anda tidak memiliki izin untuk aksi ini");
      }
    }

    return true;
  }
}
