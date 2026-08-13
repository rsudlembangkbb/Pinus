import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Permission, RoleCode } from "@pinus/shared";
import { api, refreshSession, setAccessToken } from "@/lib/api-client";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  employeeId: string | null;
  mustChangePassword: boolean;
  permissions: Permission[];
  workUnitIds: string[];
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (...perms: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await refreshSession();
      setUser(res ? (res.user as SessionUser) : null);
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: SessionUser }>("/auth/login", { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get<{ user: SessionUser }>("/auth/me");
    setUser(res.user);
  }, []);

  const hasPermission = useCallback(
    (...perms: Permission[]) => !!user && perms.every((p) => user.permissions.includes(p)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, hasPermission }),
    [user, loading, login, logout, refreshUser, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
