import { PERIOD_STATUS_LABELS, PeriodStatus } from "@pinus/shared";
import clsx from "clsx";

const COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  CALCULATED: "bg-blue-100 text-blue-700",
  UNIT_VERIFICATION: "bg-purple-100 text-purple-700",
  FINANCE_VERIFICATION: "bg-indigo-100 text-indigo-700",
  DIRECTOR_APPROVAL: "bg-orange-100 text-orange-700",
  FINAL: "bg-teal-100 text-teal-700",
  PUBLISHED: "bg-pinus-100 text-pinus-700",
};

export function PeriodStatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("badge", COLORS[status] ?? "bg-gray-100 text-gray-700")}>
      {PERIOD_STATUS_LABELS[status as PeriodStatus] ?? status}
    </span>
  );
}

const DECISION_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  APPROVED: "bg-pinus-100 text-pinus-700",
  REJECTED: "bg-red-100 text-red-700",
};

const DECISION_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export function DecisionBadge({ decision }: { decision: string }) {
  return (
    <span className={clsx("badge", DECISION_COLORS[decision] ?? "bg-gray-100 text-gray-600")}>
      {DECISION_LABELS[decision] ?? decision}
    </span>
  );
}
