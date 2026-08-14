'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: number;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await api.get<Notification[]>('/api/notifications');
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(n: Notification) {
    if (n.isRead) return;
    await api.post(`/api/notifications/${n.id}/read`);
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Notifikasi</h1>
      <div className="card divide-y divide-slate-100">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Tidak ada notifikasi.</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={`block w-full px-2 py-3 text-left ${n.isRead ? '' : 'bg-lembang-50/60'}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-800">{n.title}</p>
                <span className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(n.createdAt * 1000), { addSuffix: true, locale: idLocale })}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{n.body}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
