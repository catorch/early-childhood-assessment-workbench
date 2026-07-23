import { Suspense } from "react";

import { AssessmentIntake } from "@/components/assessment-intake";
import { PageShell } from "@/components/ui/app-patterns";

export default function NewAssessmentPage() {
  return <Suspense fallback={<PageShell><div className="mt-9 rounded-2xl border border-border bg-surface px-5 py-8 text-muted-foreground">Loading assessment...</div></PageShell>}><AssessmentIntake /></Suspense>;
}
