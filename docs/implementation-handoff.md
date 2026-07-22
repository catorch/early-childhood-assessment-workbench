# HELP AI Crediting Companion: Implementation Handoff

Last updated: 2026-07-21

## Current Product Path

The working path is deliberately direct:

1. An Educator signs in and selects an assigned child.
2. The Educator creates a dated assessment and uploads one observational video.
3. The processor receives a normalized video reference plus the age-at-observation snapshot and eligible catalog rows.
4. The scoring adapter returns a provisional evidence set and only `PRESENT`, `EMERGING`, `NOT_OBSERVED`, or no draft credit.
5. The Educator reviews every item, may intentionally save Blank, adds missed skills, and owns N/A, atypical credits, and the additive `O` concern flag.
6. Finalization derives the summary from saved decisions, rejects an earlier-minus/later-plus conflict in the same strand, and creates a read-only record with PDF download.
7. The child record keeps every finalized assessment and compares the latest two by skill credit.

## Application Boundaries

- Web: Next.js App Router and React.
- Identity: first-party email/password with scrypt credentials and single-use invitation/reset links, or sanitized sandbox profiles.
- State: `readPilotState` / `updatePilotState`, backed by local JSON or Prisma/Neon through `HELP_REVIEW_STATE_ADAPTER`.
- Video: local private files for development or private GCS objects in the reference GCP deployment.
- Processing: local HTTP processor or GCS/Eventarc to private Cloud Run.
- Scoring: versioned `help-scoring-v0` request/result validation with fake, Gemini, Vertex, and built-in `evidence-first-v1` adapters.
- Catalog: versioned `help-catalog-v1` JSON with immutable version/digest checks.
- Email: console development adapter or the client's configured sender.

## Workbook Artifact

Run:

```bash
pnpm catalog:import-help
pnpm catalog:validate content/help-catalog.client-reference.json
```

The importer preserves all 810 workbook rows, 62 strands, 18 always-assess markers, 766 distinct displayed skill codes, decimal/open-ended age labels, workbook order, the `0.0` regulatory/sensory section, and row-level identifiers for duplicate codes. The generated artifact is intentionally `REFERENCE`; it cannot enable real-data mode until the client approves it and supplies the complete licensed credit criteria.

## Yi Model Handoff

Yi's repository is not accessible yet. No staged schema has been invented from the meeting discussion. When access arrives, verify the actual Pydantic inputs/outputs and configuration reference, then map them at the existing scoring gateway boundary:

- Input: canonical private media reference, observation date, age-at-observation snapshot, support context, model-eligible catalog candidates, and the three AI draft definitions.
- Output: candidate-row identity, optional draft credit, confidence, uncertainty reason, and one or more timestamped observation statements.
- Current internal evidence ordering is primary-first: `evidence[0]` is shown as the primary moment and later entries as supporting moments. This is an internal UI convention, not an assumption about Yi's external schema; her declared primary event should be mapped first after the real contract is available.
- Persisted provenance: one scoring configuration reference on the processing run.

The built-in `evidence-first-v1` scorer remains an explicit fallback. Uploaded video remains the primary media path; optional YouTube input should normalize into the same boundary only after Yi's real contract is verified.

## Future HELP Connect Boundary

Keep future integration to three adapters when its contract is available: roster/assignment input, compatible staff identity, and finalized-result output. The standalone assessment workflow does not depend on those details.
