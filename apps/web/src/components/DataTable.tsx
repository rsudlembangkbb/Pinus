import type { ReactNode } from "react";
import { EmptyState, Input, Spinner } from "@/components/ui";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  loading?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  toolbarExtra?: ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  keyFor,
  loading,
  search,
  onSearchChange,
  searchPlaceholder = "Cari…",
  total,
  page = 1,
  pageSize = 25,
  onPageChange,
  emptyTitle = "Belum ada data",
  toolbarExtra,
}: DataTableProps<T>) {
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

  return (
    <div>
      {(onSearchChange || toolbarExtra) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {onSearchChange && (
            <div className="w-full max-w-xs">
              <Input placeholder={searchPlaceholder} value={search ?? ""} onChange={(e) => onSearchChange(e.target.value)} />
            </div>
          )}
          <div className="flex-1" />
          {toolbarExtra}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-2.5 ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                  <Spinner className="mx-auto h-5 w-5" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={keyFor(row)} className="hover:bg-slate-50/60">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-2.5 align-middle text-slate-700 ${col.className ?? ""}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages !== undefined && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Halaman {page} dari {totalPages} ({total} data)
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
