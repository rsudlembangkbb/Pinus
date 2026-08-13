import type { Permission, RoleCode } from "@pinus/shared";
import type { Database } from "../db/client.js";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  employeeId: string | null;
  mustChangePassword: boolean;
  permissions: Permission[];
  workUnitIds: string[];
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Database;
    user: AuthUser | null;
  };
};
