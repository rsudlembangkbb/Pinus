import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useNotifications } from "@/hooks/useNotifications";

const KIND_LABELS: Record<string, string> = {
  PERIOD_STATUS_CHANGE: "Status Periode",
  APPROVAL_REQUIRED: "Menunggu Persetujuan",
  REJECTED: "Dikembalikan",
  PUBLISHED: "Dipublikasikan",
  IMPORT_RESULT: "Hasil Impor",
};

export function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const queryClient = useQueryClient();
  const markAllRead = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div>
      <PageHeader
        title="Notifikasi"
        action={
          !!data?.unreadCount && (
            <Button variant="secondary" onClick={() => markAllRead.mutate()}>
              Tandai semua dibaca
            </Button>
          )
        }
      />
      <Card>
        {isLoading ? null : data?.items.length === 0 ? (
          <EmptyState title="Tidak ada notifikasi" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data?.items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.isRead && markRead.mutate(n.id)}
                className={`flex w-full flex-col items-start gap-1 px-5 py-3.5 text-left hover:bg-slate-50 ${n.isRead ? "" : "bg-pinus-50/50"}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{n.title}</span>
                  <Badge tone={n.isRead ? "slate" : "green"}>{KIND_LABELS[n.kind] ?? n.kind}</Badge>
                </div>
                <p className="text-xs text-slate-500">{n.body}</p>
                <p className="text-[11px] text-slate-400">{n.createdAt.slice(0, 16).replace("T", " ")}</p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
