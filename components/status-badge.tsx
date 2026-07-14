import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const statusTone: Record<string, "success" | "warning" | "destructive" | "info" | "secondary"> = {
  FINALIZED: "success",
  READY_FOR_REVIEW: "info",
  IN_REVIEW: "info",
  PROCESSING: "warning",
  QUEUED: "warning",
  FAILED: "destructive"
};

export function StatusBadge({ status, label, className, children }: { readonly status: string; readonly label: string; readonly className?: string; readonly children?: ReactNode }) {
  return <Badge className={cn("capitalize", className)} variant={statusTone[status] ?? "secondary"}>{children}{label}</Badge>;
}
