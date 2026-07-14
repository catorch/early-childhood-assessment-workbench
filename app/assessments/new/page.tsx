import { Suspense } from "react";

import { AssessmentIntake } from "@/components/assessment-intake";
import { PageShell } from "@/components/ui/app-patterns";

export default function NewAssessmentPage() {
  return <Suspense fallback={<PageShell><div className="mt-9 border-t border-border py-8 text-muted-foreground">Loading assessment...</div></PageShell>}><AssessmentIntake /></Suspense>;
}
