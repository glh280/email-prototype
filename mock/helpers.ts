import { STAGES, type StageKey } from "./types";

export function stageLabel(key: StageKey): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

export function stageIndex(key: StageKey): number {
  return STAGES.findIndex((s) => s.key === key);
}

export function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (Math.abs(diffSec) < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return diffMin > 0 ? `${diffMin}m ago` : `in ${-diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return diffHr > 0 ? `${diffHr}h ago` : `in ${-diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return diffDay > 0 ? `${diffDay}d ago` : `in ${-diffDay}d`;
  const diffMo = Math.round(diffDay / 30);
  return diffMo > 0 ? `${diffMo}mo ago` : `in ${-diffMo}mo`;
}

export function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function priorityColor(p: "low" | "med" | "high"): string {
  if (p === "high") return "bg-red-500";
  if (p === "med") return "bg-amber-500";
  return "bg-slate-400";
}
