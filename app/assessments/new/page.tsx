import { Suspense } from "react";

import { AssessmentIntake } from "@/components/assessment-intake";

export default function NewAssessmentPage() {
  return <Suspense fallback={<main className="page-shell"><div className="loading-block">Loading assessment...</div></main>}><AssessmentIntake /></Suspense>;
}
