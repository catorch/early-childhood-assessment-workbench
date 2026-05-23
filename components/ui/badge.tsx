import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "amber" | "red" | "purple" | "gray";

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={cn("badge", tone)}>{children}</span>;
}
