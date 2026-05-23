import type { CreditAssignment, ReviewPriority, RunStatus, VideoStatus } from "@/lib/types";

export function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDecimal(value: number, digits = 2) {
  return value.toFixed(digits);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function creditLabel(credit: CreditAssignment) {
  const labels: Record<CreditAssignment, string> = {
    CREDIT: "Full",
    PARTIAL_CREDIT: "Partial",
    NO_CREDIT: "None",
    NOT_OBSERVED: "Not Observed",
    UNCERTAIN: "Uncertain"
  };
  return labels[credit];
}

export function creditTone(credit: CreditAssignment) {
  const tones: Record<CreditAssignment, "green" | "amber" | "red" | "gray" | "blue"> = {
    CREDIT: "green",
    PARTIAL_CREDIT: "amber",
    NO_CREDIT: "red",
    NOT_OBSERVED: "gray",
    UNCERTAIN: "blue"
  };
  return tones[credit];
}

export function statusLabel(status: VideoStatus | RunStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function priorityLabel(priority?: ReviewPriority) {
  if (!priority) return "Normal";
  return `${priority[0]}${priority.slice(1).toLowerCase()} Priority`;
}

export function priorityTone(priority?: ReviewPriority) {
  if (priority === "HIGH") return "red";
  if (priority === "MEDIUM") return "amber";
  if (priority === "LOW") return "blue";
  return "gray";
}

export function trendText(delta: number, suffix = "") {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(Math.abs(delta) < 1 ? 2 : 0)}${suffix}`;
}
