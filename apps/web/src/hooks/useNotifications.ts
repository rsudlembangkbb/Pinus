import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@pinus/shared";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ items: Notification[]; unreadCount: number }>("/notifications"),
    enabled: !!user,
    refetchInterval: 60_000,
  });
}
