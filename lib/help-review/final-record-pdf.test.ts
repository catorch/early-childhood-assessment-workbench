import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { deriveReviewSummary } from "./domain";
import { createFakeScoringResult } from "./fake-scoring";
import { createFinalRecordPdf } from "./final-record-pdf";
import { createSanitizedPilotState } from "./fixtures";

describe("final assessment PDF", () => {
  it("renders sanitized Unicode and long unbroken educator content", async () => {
    const suggestion = {
      ...createFakeScoringResult("pdf-test")[0]!,
      skillName: `Uses a child-sized tool – ${"x".repeat(700)}`
    };
    const summary = deriveReviewSummary([suggestion], [{
      suggestionId: suggestion.id,
      educatorId: "user-educator-1",
      origin: "ACCEPTED",
      finalCredit: "PRESENT",
      dismissed: false,
      concernFlag: true,
      note: `Educator noted “direct observation” ${"y".repeat(1_000)}`,
      revision: 1,
      decidedAt: "2026-07-21T14:00:00.000Z"
    }]);
    const child = createSanitizedPilotState().children[0]!;

    const bytes = await createFinalRecordPdf({
      assessment: {
        observationDate: "2026-07-21",
        ageMonthsAtObservation: 19,
        finalizedAt: "2026-07-21T14:00:00.000Z",
        finalizedBy: "Alex Morgan"
      },
      child,
      summary
    });
    const document = await PDFDocument.load(bytes);

    expect(Buffer.from(bytes).subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(document.getTitle()).toContain(child.externalChildId);
  });
});
