export function formatRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "Rp 0";
  const n = Math.round(Number(value));
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("id-ID");
}

export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0%";
  return `${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}
