"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@pinus/shared";
import { apiClient, clearTokens, getAccessToken, setTokens } from "./api-client";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  employeeId: string | null;
  employee?: {
    id: string;
    fullName: string;
    nip: string;
    staffCategory: string;
    workUnit: { id: string; name: string };
  } | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refetchMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await apiClient.get<CurrentUser>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { data } = await apiClient.post("/auth/login", { identifier, password });
      setTokens(data.accessToken, data.refreshToken);
      await fetchMe();
      router.push("/dashboard");
    },
    [fetchMe, router],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetchMe: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
