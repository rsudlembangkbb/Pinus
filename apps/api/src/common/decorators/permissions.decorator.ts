import { SetMetadata } from "@nestjs/common";
import { Permission } from "@pinus/shared";

export const PERMISSIONS_KEY = "permissions";

/** Restricts a route to callers whose role grants all of the given permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
