# Tasks: HELP Review Pilot Platform

Generated with the Kiro spec-driven workflow.

Source requirements: `docs/specs/help-review-production-platform/requirements.md`  
Source design: `docs/specs/help-review-production-platform/design.md`  
Screen catalogue: `docs/specs/help-review-production-platform/ui-ux-screens/SCREEN-MATRIX.md`

## Execution Rules

- Implement the July 10 pilot requirements and later explicit stakeholder decisions only.
- Treat all 45 accepted images as route-state and responsive acceptance references, not as permission to invent unsupported behavior.
- Treat every image in `ui-ux-screens/_rejected/` as excluded design exploration.
- Implement exactly one approved production identity path: HELP Connect reuse when feasible, otherwise managed administrator-provisioned email/password. Do not ship parallel modes or a custom password store.
- Hide and server-reject conditional features until approved: add-on flags, manual omitted-skill creation, alternate final outputs, and the non-selected identity path.
- Keep AI suggestions separate from Educator decisions and derive all progress/final values on the server.
- Enforce assignment and state authorization in services/repositories and route handlers, not only in navigation.
- Use sanitized data until identity, permission, storage, retention, deletion, vendor, and incident ownership decisions are accepted.
- Keep each numbered subtask independently reviewable. Estimates are focused engineering time and exclude stakeholder or vendor wait time.
- A checkbox is complete only when implementation, focused tests, accessibility behavior, and referenced screen states pass. Existing checked baseline work must still pass the final gates.

## Sanitized Runtime Status

As of July 13, 2026, the complete user-facing Educator journey and minimal Admin workflow are implemented in the repository against the fail-closed sanitized adapters. This includes role-aware sessions, assignment-scoped child and assessment navigation, permission-gated upload, resumable processing state, validated fake scoring, real private byte-range playback, every approved review decision path, revision conflicts, server-derived summary/finalization, staff-role provisioning, assignment changes, and failed/stuck processing retry.

The sanitized shared-demo deployment boundary is also implemented: pooled Neon runtime access through Prisma's Neon adapter, direct migration access, normalized transactional persistence with an advisory write lock, persisted support events, private Vercel Blob client uploads, completion metadata verification, replacement cleanup, authorized media streaming, and production configuration guards. Both migrations were applied to the new sanitized Neon database, and a revoke/read/restore authorization smoke test passed across separate sessions. The linked Vercel project's production variables and private Blob store are configured. The sanitized build is live at `https://earlychildhoodassessment.vercel.app`.

The implementation has passed TypeScript, ESLint, 46 focused Vitest checks, Prisma validation, an optimized Next.js production-environment build, direct authorization/permission requests, a Neon persistence smoke test, and interactive Playwright checks across desktop, tablet, and 360 px mobile states. Live smoke coverage passed sandbox sign-in, assigned and permission-blocked views, idempotent draft replay, direct private-Blob upload, processing-to-review, saved-decision persistence, authorized `206` media ranges, unauthenticated object denial, cross-origin rejection, and unassigned-resource denial. The deterministic local state is recreated from `lib/help-review/fixtures.ts`; `.data/` remains ignored.

The user-facing frontend has also completed its Tailwind CSS 4 and selective shadcn/ui migration. The legacy global selector layer has been removed; HELP semantic tokens, shared application patterns, Lucide controls, Radix-backed dialogs/tooltips, responsive review modes, and flat screen-catalogue styling now cover every implemented route. Repeatable Playwright smoke coverage and three approved migration baselines protect sign-in, assigned children, educator review, mobile editor, and Admin navigation. The broader 45-state deterministic visual suite remains correctly unchecked in Task 11.4.

Unchecked boxes are intentionally retained wherever the task's completion criteria require an approved external contract, organization-owned infrastructure, provider contract tests, backup/restore or rollback evidence, staging acceptance, stakeholder approval, or a committed 45-state regression baseline. The shared Vercel/Neon demo does not satisfy those real-production gates, and real child data remains disabled.

## 1. Resolve Live-Integration Contracts

- [ ] 1.1 Confirm the scientist scoring contract (2-4 hours)
  - Record request identity/idempotency, required child context, approved video transfer, authentication, job states, completion mechanism, schema version, success/uncertainty payloads, safe errors, timeout, and retry policy.
  - Obtain sanitized fixtures for accepted, uncertain, invalid-credit, invalid-evidence, empty-result, slow, retryable-failure, and terminal-failure outcomes.
  - Choose polling, callback, or another single completion contract; do not implement competing mechanisms.
  - Verify the scientist owner accepts all-or-nothing application validation and safe diagnostic references.
  - _Artifacts: approved contract record and versioned sanitized fixtures_
  - _Requirements: R4, R5, R7, NFR-2, NFR-4, NFR-6_

- [ ] 1.2 Confirm roster, identifier, assignment, and context inputs (2-4 hours)
  - Record the stable child identifier, age source, approved disability/IFSP/support context, processing-permission source, Educator identity mapping, assignment source, update cadence, and deactivation behavior.
  - Keep minimal access and assignment controls in `/admin/access`; decide whether existing child records arrive through a controlled import or upstream integration and document that ingestion contract.
  - Define validation and reconciliation for missing, duplicate, inactive, or revoked records.
  - _Screens: 02, 12, 13, 14, 16, 20, 28_
  - _Requirements: R2, R3, R7, R8_

- [ ] 1.3 Confirm video policy and storage contract (2-4 hours)
  - Approve types, size/duration/integrity limits, upload method, resumability requirement, private storage location, byte-range playback, grant lifetime, permission check, retention, deletion, backup behavior, and incident owner.
  - Define incomplete upload cleanup and replacement/removal behavior before processing.
  - Keep real child video disabled until the approval record is complete.
  - _Screens: 03, 17, 18, 19, 20, 24, 35_
  - _Requirements: R3, R5, R8, NFR-3, NFR-6_

- [ ] 1.4 Confirm HELP content and final-output contracts (2-4 hours)
  - Select one display label for canonical `NOT_OBSERVED` and approve the four primary credit descriptions.
  - Confirm uncertain-item behavior, evidence fields, dismiss semantics, note limits, and whether `ATYPICAL`/`FAMILY_CONCERN` flags are approved, renamed, or omitted.
  - Confirm that manual omitted-skill entry remains excluded or define a requirements change before implementation.
  - Confirm whether the on-screen final record is sufficient or define an authorized integration/download contract.
  - _Screens: 05, 06, 07, 27, 37, 38, 39, 41, 42, 43_
  - _Requirements: R5, R6, NFR-1, NFR-4_

- [ ] 1.5 Confirm HELP Connect identity and AWS ownership (2-4 hours)
  - Document HELP Connect's identity provider/protocol, stable subject, login/callback/logout behavior, session and deactivation behavior, account lifecycle, sandbox, and technical owner.
  - Select HELP Connect reuse or one managed email/password provider. Record why, provider-hosted setup/recovery, rate limiting, revocation, and future federation/migration; do not implement both.
  - Record the target organization-controlled AWS account/environment, service and budget owners, secret ownership, cost visibility, transfer path, and deployment constraints.
  - _Screens: 01, 10, 11, 15, 40_
  - _Requirements: R1, R8, NFR-4, NFR-6_

- [ ] 1.6 Publish the decision register and change gate (2-3 hours)
  - Record owner, date, evidence, decision, affected requirement/design/task IDs, and release behavior for each gate in Tasks 1.1-1.5.
  - Mark unapproved flags, labels, outputs, providers, and real-data use as fail-closed configuration.
  - Require an explicit requirements revision before adding any out-of-scope surface.
  - _Requirements: R1-R8, NFR-4_

## 2. Establish The Production Code Boundary

- [x] 2.1 Preserve the current prototype work before cleanup (2-3 hours)
  - Inventory dirty tracked/untracked files and preserve useful HELP Review spike work without reverting unrelated user changes.
  - Use Git history for the old reliability workbench instead of a searchable runtime `legacy` folder.
  - Revalidate the preserved baseline before merge because the workspace remains an active spike.
  - _Requirements: NFR-4_

- [x] 2.2 Remove legacy runtime routes and navigation (3-4 hours)
  - Keep the educator-first shell and root redirect while removing dashboard, videos registry, reliability, prompt, workbench review, and workbench settings routes.
  - Confirm removed routes are absent from runtime navigation and route tests.
  - _Requirements: R2, R5, Explicitly Out Of Scope_

- [x] 2.3 Remove legacy APIs and seeded workbench dependencies (3-4 hours)
  - Remove prompt, reliability, human-rating, batch, export, and obsolete video registry endpoints and runtime data dependencies.
  - Keep a primitive/helper only when a current pilot test consumes it.
  - _Requirements: NFR-4, Explicitly Out Of Scope_

- [ ] 2.4 Complete the lean Prisma schema and migrations (3-4 hours)
  - Implement only identity/access/session support required by the selected provider plus `Child`, `ChildAssignment`, `Assessment`, `VideoAsset`, `VideoAccessGrantRecord`, `ProcessingRun`, `SkillSuggestion`, and `ReviewDecision`.
  - Add actor/time, revision, uniqueness, status, and conditional-value constraints from the design; do not store credentials or temporary playback secrets.
  - Generate and validate migration SQL, then test apply and forward/rollback recovery against an approved non-production database.
  - _Files: `prisma/schema.prisma`, migrations, schema tests_
  - _Requirements: R1-R8, NFR-2, NFR-4, NFR-6_

- [x] 2.5 Keep the HELP domain lean and deterministic (2-3 hours)
  - Retain two roles, four canonical credits, four decision origins, state validation, sanitized fixtures, and no speculative manual-add origin.
  - Revalidate current domain tests against the expanded requirements and conditional-feature gates.
  - _Files: `lib/help-review/domain.ts`, domain tests_
  - _Requirements: R5, R6, R8, NFR-4_

- [ ] 2.6 Introduce service/repository interfaces and production adapter guards (3-4 hours)
  - Define `IdentityAdapter`, `AuthorizationPolicy`, repositories, `AssessmentService`, `VideoStorage`, `ProcessingCoordinator`, `ScoringGateway`, `ReviewService`, `AdminService`, and `SupportRecorder` boundaries.
  - Move route-handler business logic behind these boundaries and make dependencies injectable in tests.
  - Fail production startup when file-backed state, fake identity, fake scoring, local video, or incomplete required configuration is selected.
  - _Files: `lib/help-review/server/**`, application bootstrap/config tests_
  - _Requirements: NFR-2, NFR-4, NFR-6_

- [x] 2.7 Build the shared operational UI primitives and shell (3-4 hours)
  - Implement `AppHeader`, navigation, `PageStatus`, status badges, progress, dialogs, tables/labeled mobile lists, skeletons, alerts, form errors, and icon buttons using existing local patterns and Lucide.
  - Add stable dimensions, focus states, live regions, semantic colors, 6-8 px corners, and no nested-card or marketing layout.
  - Make role-specific navigation hide unsupported routes without treating hiding as authorization.
  - _Screens: shared by 01-45_
  - _Requirements: NFR-1, NFR-5_

- [ ] 2.8 Create the deterministic screen-state fixture harness (3-4 hours)
  - Add sanitized factories and route/API overrides for each accepted screen ID, including loading, empty, failure, permission, conflict, and confirmation states.
  - Keep ImageGen values out of production seed data and exclude `_rejected/` assets from test discovery.
  - Name screenshot/story fixtures `screen-01` through `screen-45` for traceability.
  - _Requirements: R1-R8, NFR-1, NFR-5_

## 3. Implement Identity, Sessions, And Protected Access

- [ ] 3.1 Integrate exactly the selected identity adapter (3-4 hours)
  - Validate provider results server-side, map stable subject to active provisioned access, establish/validate the selected session contract, and implement sign-out/deactivation.
  - For managed email/password only, hand setup, verification, recovery, brute-force protection, and credential storage to the approved provider.
  - Reject public signup and return non-enumerating responses.
  - _Files: selected auth adapter, session middleware, `/api/session` or provider routes_
  - _Requirements: R1, R8_

- [ ] 3.2 Build fallback sign-in and safe failure states (3-4 hours)
  - Implement `/sign-in` idle/submitting/safe-error behavior for the managed fallback, or replace it with the approved HELP Connect handoff.
  - Clear secrets after failure, restore error focus, preserve only approved email state, and wire provider-owned recovery/help.
  - Validate desktop and mobile composition.
  - _Screens: 01, 10, 40_
  - _Requirements: R1, NFR-1, NFR-5_

- [ ] 3.3 Implement session interruption and authorized resume (3-4 hours)
  - Detect expiry for navigation and mutations; do not show a failed mutation as saved.
  - Store a server-validated relative return target without protected query payloads, then reauthorize and resolve current assessment state after sign-in.
  - Add timeout, sign-out, revocation, and unsafe-return-path tests.
  - _Screen: 11_
  - _Requirements: R1, NFR-2, NFR-6_

- [x] 3.4 Implement the non-disclosing resource state (2-3 hours)
  - Map unauthorized and missing child/assessment/video/final resources to one reusable presentation and safe public error envelope.
  - Retain the internal denial reason only in redacted support telemetry.
  - _Screen: 15_
  - _Requirements: R1, R2, R8_

- [x] 3.5 Enforce the authorization matrix centrally (3-4 hours)
  - Check active session, user, role, active assignment, assessment ownership, processing permission, and record state in every relevant service/repository command.
  - Ensure Admin has no implicit child, video, review, summary, or final access.
  - Test direct URLs/APIs, identifier substitution, deactivation, unassignment, finalized mutation, and concurrent revocation.
  - _Requirements: R1, R2, R7, R8, NFR-2_

## 4. Deliver Assigned-Child And Assessment Navigation

- [x] 4.1 Implement assignment-scoped child and assessment projections (3-4 hours)
  - Query only minimum approved context, assessment status/progress, dates, and next-action fields under the current assignment predicate.
  - Implement authoritative next-route resolution for draft, upload, processing, failed, review, summary, and final states.
  - Add `GET /api/children`, child detail/history, and `GET /api/assessments` contracts with safe filters.
  - _Requirements: R2, R6, R8, NFR-2_

- [x] 4.2 Build the populated assigned-children page (3-4 hours)
  - Implement desktop list/search, status/progress, last observation, and exactly one resolved next action per row.
  - Keep search within the authorized result and preserve keyboard/focus behavior.
  - _Screen: 02_
  - _Requirements: R2, NFR-1, NFR-5_

- [x] 4.3 Build child-list empty and load-error states (2-3 hours)
  - Separate successful zero assignments from transient failure.
  - Wire refresh/retry, Admin guidance, and safe sign-out without rendering stale rows as current.
  - _Screens: 12, 13_
  - _Requirements: R2, NFR-2, NFR-6_

- [x] 4.4 Build child detail and assessment history (3-4 hours)
  - Show approved child context, `Upload observation`, authorized history, progress, dates, and state-resolved row actions.
  - Redirect stale actions to the current authorized route.
  - _Screen: 14_
  - _Requirements: R2, R3, R6, R8_

- [x] 4.5 Build the assessment index (3-4 hours)
  - Add `/assessments` with URL-backed active/finalized/all filters, safe identifier search, progress, updated time, and next actions.
  - Cover no matches separately from query failure and keep all results assignment-scoped.
  - _Screen: 16_
  - _Requirements: R2, R6, NFR-1_

- [x] 4.6 Implement mobile child navigation (2-3 hours)
  - Transform rows into labeled list items with identifier/status/action first and secondary context below.
  - Preserve filters, account/help, assignment guidance, and no horizontal scrolling at 360 px.
  - _Screen: 34_
  - _Requirements: R2, NFR-1, NFR-5_

- [ ] 4.7 Verify child and assessment navigation end to end (2-4 hours)
  - Test populated, empty, failure, search/filter, stale route, direct unassigned access, assignment revocation, and each next-action mapping.
  - Capture screen fixtures 02, 12, 13, 14, 16, and 34.
  - _Requirements: R1, R2, R6, R8, NFR-1, NFR-2_

## 5. Deliver Assessment Intake And Private Upload

- [ ] 5.1 Implement idempotent assessment draft creation (3-4 hours)
  - Bind the authorized child, Educator, observation date, minimum context snapshot, permission state, and content contract.
  - Require an idempotency key and return the same authorized draft for a repeated accepted command.
  - Reject finalized, unassigned, inactive, or permission-blocked submissions.
  - _Requirements: R3, R8, NFR-2_

- [ ] 5.2 Implement the selected `VideoStorage` adapter (3-4 hours)
  - Create private upload intent, verify completion metadata/checksum/duration as supported, support byte ranges, issue short-lived playback, and invalidate incomplete/replaced objects.
  - Persist object identifiers and metadata only, never temporary URLs.
  - Add adapter contract tests for success, expired intent, mismatch, incomplete object, replacement, and unauthorized playback.
  - _Requirements: R3, R5, R8, NFR-3, NFR-4_

- [ ] 5.3 Implement upload create/complete/remove commands (3-4 hours)
  - Enforce assignment, draft state, permission, type/size/duration/integrity limits, one active asset, and duplicate completion safety.
  - Keep the draft recoverable after cancellation or failure and prevent processing until verified availability.
  - _Requirements: R3, R8, NFR-2_

- [x] 5.4 Build uploading and ready states (3-4 hours)
  - Show child/date, file identity, measurable byte progress, pending state, verified metadata, replace/remove, save-and-exit, and idempotent processing submission.
  - Do not fabricate duration or progress when the adapter cannot measure it.
  - _Screens: 03, 17_
  - _Requirements: R3, NFR-1, NFR-3_

- [x] 5.5 Build validation and interrupted-transfer recovery (3-4 hours)
  - Map approved validation codes to inline errors and clear rejected file handles without losing the draft.
  - Resume only when the selected adapter supports it; otherwise invalidate incomplete bytes and restart without duplicate assets.
  - _Screens: 18, 19_
  - _Requirements: R3, NFR-2, NFR-6_

- [x] 5.6 Build processing-permission blocked behavior (2-3 hours)
  - Resolve permission before issuing upload credentials and enforce the same rule on direct upload/process requests.
  - Show safe status, return/cancel, and Admin guidance without leaking unapproved context.
  - _Screen: 20_
  - _Requirements: R3, R8_

- [ ] 5.7 Implement the mobile intake composition (2-3 hours)
  - Stack context, date, upload state, file controls, privacy status, and bottom actions with reserved space for errors and the virtual keyboard.
  - Verify replacement/removal and pending actions at 360 px and 200% zoom.
  - _Screen: 35_
  - _Requirements: R3, NFR-1, NFR-5_

- [ ] 5.8 Verify upload behavior end to end (3-4 hours)
  - Test valid, invalid type/size/duration, interrupted, repeated completion, replacement, removal, refresh/resume, permission blocked, deactivation, and duplicate processing clicks.
  - Capture screen fixtures 03, 17, 18, 19, 20, and 35.
  - _Requirements: R3, R8, NFR-1, NFR-2, NFR-3_

## 6. Integrate Durable Scientist Processing

- [ ] 6.1 Implement versioned scoring schemas and fake gateway (3-4 hours)
  - Encode the confirmed submission/receipt/status/result contracts with Zod and normalize only approved review fields.
  - Add deterministic queued, running, valid, uncertain, invalid, empty, slow, retryable-failed, and terminal-failed scenarios.
  - Reject unknown credits, duplicate suggestion IDs, mismatched run IDs, invalid timestamps, unsupported flags, oversized payloads, and partial results.
  - _Requirements: R4, R5, NFR-4_

- [ ] 6.2 Implement the real server-only scoring gateway (3-4 hours)
  - Add selected authentication, submission, status or callback handling, safe timeouts, and error mapping exactly as contracted.
  - Send only approved context and approved time-limited video transfer.
  - Keep credentials, raw provider failures, and unrestricted payloads out of browser responses and telemetry.
  - _Requirements: R4, R8, NFR-4, NFR-6_

- [ ] 6.3 Implement the durable processing coordinator (3-4 hours)
  - Create/observe runs through the approved queue, scheduler, workflow, or authenticated callback path so progress does not depend on an open browser.
  - Apply contracted backoff, timeout, serialization, dead-letter/follow-up, and restart recovery.
  - Stop browser status polling on terminal state, auth loss, page hide backoff, or unmount without stopping server work.
  - _Requirements: R4, NFR-2, NFR-3, NFR-6_

- [x] 6.4 Persist runs and results transactionally (3-4 hours)
  - Allocate unique attempt numbers, prevent concurrent active runs, retain prior failures, and atomically store a complete validated suggestion set.
  - Never overwrite review work with retry results; define the allowed retry boundary before review begins.
  - Record requester, timestamps, safe category/reference, and retry relationship.
  - _Requirements: R4, R7, R8, NFR-2_

- [x] 6.5 Build running and ready processing states (3-4 hours)
  - Render persisted completed/current/pending steps, file identity, last update, leave/return, visibility-aware refresh, validated counts, and start/resume review.
  - Ensure ready appears only after complete result commit.
  - _Screens: 04, 22_
  - _Requirements: R4, NFR-1, NFR-3_

- [x] 6.6 Build the failed processing and Educator retry state (3-4 hours)
  - Show safe category/reference, retained-video availability, retry eligibility, return, and idempotent retry.
  - Recheck assignment, permission, asset availability, active run, and policy inside retry creation.
  - _Screen: 21_
  - _Requirements: R4, R7, NFR-2, NFR-6_

- [x] 6.7 Implement mobile processing (2-3 hours)
  - Use a vertical timeline with stable file/status details and reachable refresh/return actions.
  - Verify browser backgrounding, refresh, and return do not reset the run.
  - _Screen: 36_
  - _Requirements: R4, NFR-1, NFR-5_

- [ ] 6.8 Verify processing contracts and recovery (3-4 hours)
  - Run fake and selected-provider contract tests for submit, completion, invalid/empty payload, timeout, duplicate callbacks/polls, restart, concurrent retry, and safe error redaction.
  - Capture screen fixtures 04, 21, 22, and 36.
  - _Requirements: R4, R7, R8, NFR-2, NFR-4, NFR-6_

## 7. Implement Review, Video, And Decision Services

- [x] 7.1 Build the authorized review projection (3-4 hours)
  - Return minimum child context, assessment progress, normalized suggestions/evidence, original drafts, current decisions/revisions, and playback metadata only.
  - Resolve loading, ready, invalid-result, resource-unavailable, and finalized redirects from authoritative state.
  - Exclude raw provider payloads and hidden conditional fields.
  - _Requirements: R4, R5, R8_

- [ ] 7.2 Implement playback grants and purpose-specific access records (3-4 hours)
  - Recheck session, assignment, asset availability, and record state before issuing each short-lived grant.
  - Persist assessment/video, viewer, and issuance time without persisting the grant token/URL.
  - Support restoration at a bounded prior playback position after grant expiry.
  - _Requirements: R5, R8, NFR-3, NFR-6_

- [x] 7.3 Implement decision command validation (3-4 hours)
  - Validate expected revision, final credit/dismissal invariant, note limit, suggestion membership, finalized immutability, and approved flag allowlist.
  - Reject unsupported/hidden flags and manually created suggestions at the API boundary.
  - Return normalized saved/current decision shapes and field errors only.
  - _Requirements: R5, R6, R8, NFR-2_

- [x] 7.4 Persist decision origins and progress transactionally (3-4 hours)
  - Derive `ACCEPTED`, `OVERRIDDEN`, `SCORED_INDEPENDENTLY`, or `DISMISSED` from original draft and saved intent.
  - Record Educator/time/revision, keep original suggestion immutable, and update server-derived progress without browser-calculated totals.
  - Prove failed writes do not change progress.
  - _Requirements: R5, R6, NFR-2_

- [x] 7.5 Implement stale-decision conflict handling (3-4 hours)
  - Return `409` with normalized current revision/value on stale writes and never overwrite automatically.
  - Support use-current and deliberate reapply-against-current commands with authorization/state rechecks.
  - Add two-session and rapid-repeat integration tests.
  - _Requirements: R5, NFR-2_

- [ ] 7.6 Verify review service invariants (3-4 hours)
  - Test uncertain scoring, accept, override, independent score, note, conditional flags enabled/disabled, dismiss, failed save, conflict, refresh restoration, grant expiry, assignment revocation, and finalized rejection.
  - _Requirements: R5, R6, R8, NFR-2, NFR-4_

## 8. Build The Full Review Experience

- [x] 8.1 Build the desktop workspace and stable loading state (3-4 hours)
  - Implement progress/header, grouped list, video/evidence region, selected-item editor, and finish entry using the shared operational layout.
  - Add final-size noninteractive skeletons and live loading status that resolve to ready/error states without layout collapse.
  - _Screens: 05, 44_
  - _Requirements: R5, NFR-1, NFR-5_

- [ ] 8.2 Implement grouped suggestions and navigation (3-4 hours)
  - Render `Needs your review` plus four credit groups, skill/domain/strand, draft/uncertainty, evidence markers, saved status, and current selection.
  - Update counts from acknowledged server state and preserve selection/group/scroll through refresh and responsive mode changes.
  - _Screen: 05_
  - _Requirements: R5, NFR-1_

- [x] 8.3 Implement real video and evidence interaction (3-4 hours)
  - Provide accessible playback, seeking, time/duration, evidence markers, timestamp activation, selected-evidence styling, and byte-range media loading.
  - Handle expired/unavailable access without discarding the editor, selection, or safe playback position.
  - _Screens: 05, 24, 37, 42_
  - _Requirements: R5, R8, NFR-1, NFR-3_

- [x] 8.4 Implement every approved editor action (3-4 hours)
  - Implement one primary credit, accept/override/independent score, note, dismiss, discard, and save with dirty/pending/saved states.
  - Render add-on flags only after Task 1.4 approves them and the server feature gate accepts them.
  - Guard navigation away from dirty state and remove any unsupported prototype control.
  - _Screens: 05, 38, 42_
  - _Requirements: R5, NFR-1, NFR-2_

- [x] 8.5 Build save-failure and conflict recovery UI (3-4 hours)
  - Retain attempted local intent, distinguish last saved value, keep progress unchanged, and offer retry/discard.
  - Present current versus attempted decisions in an accessible modal and require use-current or deliberate reapply.
  - _Screens: 23, 25_
  - _Requirements: R5, NFR-1, NFR-2_

- [x] 8.6 Build the no-valid-results state (2-3 hours)
  - Replace the review workspace with a safe invalid-result state; render no partial suggestions.
  - Show safe category/reference, retained video state, return, and authorized retry when policy permits.
  - _Screen: 26_
  - _Requirements: R4, R5, R8_

- [x] 8.7 Build mobile review list mode (3-4 hours)
  - Prioritize progress, usable video, group navigation, skill/evidence, current decision, and explicit editor opening.
  - Preserve scroll, selection, playback, and pending state across list/editor transitions.
  - _Screen: 37_
  - _Requirements: R5, NFR-1, NFR-5_

- [x] 8.8 Build mobile review editor mode (3-4 hours)
  - Implement full-height editor, back guard, skill/evidence summary, credit choices, gated flags, note, dismiss/discard, save, validation, and non-occluding bottom actions.
  - Test longest approved labels at 360 px and 200% zoom.
  - _Screen: 38_
  - _Requirements: R5, NFR-1, NFR-5_

- [x] 8.9 Build tablet review composition (2-4 hours)
  - Use two columns or a controlled video/editor pane without shrinking actions below usable size.
  - Preserve all desktop behavior, selection context, playback, and focus order.
  - _Screen: 42_
  - _Requirements: R5, NFR-1, NFR-5_

- [ ] 8.10 Verify the review workflow end to end (3-4 hours)
  - Exercise every action and recovery with keyboard, pointer, and representative assistive technology.
  - Assert real media has non-zero rendered pixels/dimensions, timestamp seeking changes time, reload restores decisions, and dirty/conflict paths never falsely save.
  - Capture screen fixtures 05, 23, 24, 25, 26, 37, 38, 42, and 44.
  - _Requirements: R4, R5, R8, NFR-1, NFR-2, NFR-3, NFR-5_

## 9. Implement Summary And Finalization

- [x] 9.1 Implement the server-derived summary projection (3-4 hours)
  - Derive total/actioned/remaining, decision-origin counts, dismissed/included counts, domain-by-credit cells, final items, and remaining items from persisted decisions.
  - Enforce reconciliation invariants and return complete/incomplete state plus revision.
  - _Requirements: R5, R6, NFR-2_

- [x] 9.2 Build the complete pre-final summary (3-4 hours)
  - Show completion, origin counts, domain matrix, final items, return-to-review, and explicit final confirmation.
  - Keep all saved decisions when navigating back and re-read current summary before confirming.
  - _Screen: 06_
  - _Requirements: R6, NFR-1_

- [x] 9.3 Build the incomplete summary state (2-3 hours)
  - Show exact remaining authorized items with deep links back to selection, current reconciled totals, and no usable final command.
  - Enforce the block server-side even if a browser crafts a finalize request.
  - _Screen: 27_
  - _Requirements: R6, NFR-2_

- [x] 9.4 Implement idempotent finalization (3-4 hours)
  - Reauthorize and rederive the current summary inside one transaction, require current revision/idempotency key, set finalizer/time once, and reject ordinary edits afterward.
  - Return the existing final record on a repeated successful command.
  - Record a safe correlation reference and never generate an unapproved PDF/export job.
  - _Requirements: R6, R8, NFR-2, NFR-6_

- [x] 9.5 Build the read-only final record (3-4 hours)
  - Render finalized metadata, human-review status, origin counts, domain totals, included skills, dismissed suggestions, and return navigation from persisted final data.
  - Remove all editable controls and redirect non-final records to their current authorized state.
  - _Screen: 07_
  - _Requirements: R6, R8, NFR-1_

- [x] 9.6 Build mobile and tablet summary/final layouts (3-4 hours)
  - Use accessible disclosure sections/labeled matrices, preserve totals and actions, reserve space for sticky controls, and wrap long labels without viewport font scaling.
  - Verify mobile final remains read-only and tablet tables remain labeled/keyboard reachable.
  - _Screens: 39, 41, 43_
  - _Requirements: R6, NFR-1, NFR-5_

- [ ] 9.7 Verify summary and finalization end to end (3-4 hours)
  - Test all origins, domains, dismissed items, remaining deep links, return-to-review, concurrent stale finalization, duplicate confirmation, final immutability, refresh/reopen, and unassigned access.
  - Capture screen fixtures 06, 07, 27, 39, 41, and 43.
  - _Requirements: R5, R6, R8, NFR-1, NFR-2_

## 10. Build Minimal Pilot Administration

- [ ] 10.1 Implement access and assignment services/APIs (3-4 hours)
  - List/filter provision records and active assignments; provision exact external identity/email and role; activate/deactivate; create/revoke one assignment.
  - Leave credentials with the selected provider and record effective actor/time/revision.
  - Revoke or reject continued access according to the identity contract and make concurrent duplicate commands safe.
  - _Requirements: R1, R7, R8, NFR-2_

- [x] 10.2 Build the populated pilot-access surface (3-4 hours)
  - Implement URL-backed filters/search, provision form/provider handoff, staff status/role, assignment controls, and authoritative refresh after mutation.
  - Keep child/video/review data out of the Admin projection.
  - _Screen: 08_
  - _Requirements: R7, R8, NFR-1_

- [x] 10.3 Build access empty and load-error states (2-3 hours)
  - Distinguish legitimate no-provision state from query failure; show one provision action for empty and safe retry for failure.
  - Disable state-dependent mutations while current access data is unknown.
  - _Screens: 28, 29_
  - _Requirements: R7, NFR-2, NFR-6_

- [x] 10.4 Build deactivation confirmation and effects (3-4 hours)
  - Show staff reference, current assignment/session impact, required acknowledgement, pending/error state, cancel, and explicit destructive action.
  - Re-read current state and revoke access only after confirmation; restore dialog focus correctly.
  - _Screen: 30_
  - _Requirements: R1, R7, R8, NFR-1_

- [x] 10.5 Build assignment-removal confirmation and effects (3-4 hours)
  - Show Educator/child references, immediate access consequence, retained-record behavior, pending/error state, cancel, and explicit removal.
  - Revoke only the selected assignment and prove subsequent direct requests fail generically.
  - _Screen: 31_
  - _Requirements: R1, R7, R8, NFR-1_

- [ ] 10.6 Implement failed/stuck job queries and retry service (3-4 hours)
  - Return safe assessment/child reference, state/category, last update, attempts, video availability, history, and computed retry eligibility.
  - Define stuck from the confirmed contract rather than browser elapsed time.
  - Recheck run, active attempt, permission, asset, and policy transactionally before creating one retry.
  - _Requirements: R4, R7, R8, NFR-2, NFR-6_

- [ ] 10.7 Build populated processing-jobs table and details (3-4 hours)
  - Add URL-backed failed/stuck filters, safe search, stable rows, details drawer, attempt timeline, video availability, support guidance, and eligible retry entry.
  - Never deliver raw provider errors, temporary video URLs, or unrestricted scoring payloads.
  - _Screen: 09_
  - _Requirements: R7, R8, NFR-1_

- [x] 10.8 Build jobs empty and load-error states (2-3 hours)
  - Show healthy no-failed/stuck state with last refresh separately from a transient query failure.
  - Close or mark stale any details drawer and disable row actions while data is unknown.
  - _Screens: 32, 45_
  - _Requirements: R7, NFR-2, NFR-6_

- [x] 10.9 Build Admin retry confirmation (3-4 hours)
  - Identify assessment/run, show safe category, confirm asset and retry eligibility, explain new attempt/history retention, and require explicit confirmation.
  - Handle concurrent retry with a safe current-state response rather than duplicate attempts.
  - _Screen: 33_
  - _Requirements: R4, R7, R8, NFR-1, NFR-2_

- [ ] 10.10 Verify Admin workflows end to end (3-4 hours)
  - Test provision, provider mapping, deactivate, assign, unassign, empty/error/retry, session revocation, no implicit video access, failed/stuck filters, eligible/ineligible/concurrent retry, and safe telemetry.
  - Capture screen fixtures 08, 09, 28, 29, 30, 31, 32, 33, and 45.
  - _Requirements: R1, R4, R7, R8, NFR-1, NFR-2, NFR-6_

## 11. Harden And Validate The Entire Platform

- [ ] 11.1 Apply the application security baseline (3-4 hours)
  - Add TLS assumptions, secure cookie/session settings, CSRF/origin protection, return-path validation, security headers/CSP, input/body/file limits, endpoint rate limits, and server-only secrets.
  - Test provider callback validation, credential-stuffing protections supplied by the selected provider, identifier substitution, forged roles, replayed commands, and unsafe media origins.
  - _Requirements: R1, R8, NFR-4, NFR-6_

- [ ] 11.2 Complete privacy and support traceability (3-4 hours)
  - Redact child data, credentials, tokens, sessions, temporary media URLs, and unrestricted scoring payloads from logs/errors/analytics.
  - Record actor/time/reference for playback grants, decisions, retry, access changes, assignment changes, and finalization using purpose-specific records.
  - Verify no protected values appear in client configuration, URLs, screenshots, health endpoints, or support UI.
  - _Requirements: R8, NFR-6_

- [ ] 11.3 Complete responsive and accessibility remediation (3-4 hours)
  - Test every workflow at 360x800, 768x1024, 1280x800, 200% zoom, keyboard only, and representative screen reader use.
  - Fix focus order/restoration, dialog containment, landmarks/headings, field errors, live regions, target size, contrast, color-only meaning, text wrapping, overlap, occlusion, and horizontal page scroll.
  - _Screens: all accepted screens_
  - _Requirements: NFR-1, NFR-5_

- [ ] 11.4 Build and approve the 45-state visual regression suite (3-4 hours)
  - Capture deterministic implementation screenshots named for IDs 01-45 and compare layout/state semantics at their designated viewport.
  - Use ImageGen assets for hierarchy review, then approve implementation baselines rather than pixel-matching generated synthetic text.
  - Add long-skill, dense-result, long-email, and localized-label stress fixtures.
  - _Requirements: R1-R8, NFR-1, NFR-5_

- [ ] 11.5 Verify performance and failure recovery (3-4 hours)
  - Prove list/review JSON excludes raw video and unrestricted payloads, playback supports byte ranges, and scoring continues after browser exit/application restart.
  - Measure representative page/query/mutation latency and payload size in staging, record release thresholds, and address regressions.
  - Exercise database, storage, identity, scoring, queue, and network failure/recovery without duplicate records or false success.
  - _Requirements: NFR-2, NFR-3, NFR-6_

- [ ] 11.6 Complete CI quality gates (3-4 hours)
  - Run formatting/lint, TypeScript, unit, integration, selected-provider contract, migration, end-to-end, accessibility, and visual suites with sanitized fixtures.
  - Fail CI on schema drift, production fake/local adapter selection, missing conditional gates, or newly reachable out-of-scope routes.
  - Publish concise artifacts for failed screen IDs and contract cases without sensitive payloads.
  - _Requirements: R1-R8, NFR-1-NFR-6_

- [x] 11.7 Audit scope and conditional-feature closure (2-3 hours)
  - Confirm no dashboard, batch, reliability, prompt/model manager, research roles, rubric editor, DAL, manual skill entry, PDF/export, amendment, public signup, parallel auth, native/offline/live recording, or generalized audit product is reachable.
  - Confirm unresolved flags and output modes are hidden and server-rejected.
  - _Requirements: Explicitly Out Of Scope, NFR-4_

## 12. Deploy, Prove, And Hand Off Production

- [ ] 12.1 Select organization-owned production services (2-4 hours)
  - Map web runtime, PostgreSQL, private object storage, background trigger/worker, identity, secrets, and telemetry to approved services in the confirmed account.
  - Record technical owner, budget owner, cost expectation, region, data boundary, and transfer responsibility for each dependency.
  - _Requirements: R1, R8, NFR-4, NFR-6_

- [ ] 12.2 Provision database and validate migrations (3-4 hours)
  - Create separated development/staging/production configuration, apply least-privilege access, run migrations, seed sanitized staging records only, and verify backup/restore.
  - Test application compatibility during deploy and document forward recovery/rollback.
  - _Requirements: NFR-2, NFR-4, NFR-6_

- [ ] 12.3 Provision private storage and lifecycle controls (3-4 hours)
  - Configure private access, encryption, CORS/media range behavior, upload limits, temporary grant expiry, incomplete-upload cleanup, and only the approved retention/deletion policy.
  - Validate no public object access and no protected identifier leakage in object paths or telemetry.
  - _Requirements: R3, R8, NFR-3, NFR-6_

- [ ] 12.4 Deploy durable processing infrastructure (3-4 hours)
  - Configure the approved trigger/worker/callback ingress, concurrency, retries, timeout, dead-letter/follow-up, health, and safe alerting.
  - Prove a run completes after browser exit and web/worker restart without duplicate suggestions.
  - _Requirements: R4, R7, NFR-2, NFR-3, NFR-6_

- [ ] 12.5 Configure selected identity and scientist sandboxes (3-4 hours)
  - Use organization-controlled secrets and callback/redirect origins, run provider contract tests, verify subject mapping/deactivation, and verify scoring submission/result handling.
  - Remove test adapters and alternative identity routes from production build/configuration.
  - _Requirements: R1, R4, R8, NFR-4_

- [ ] 12.6 Configure safe observability and support response (3-4 hours)
  - Add health/readiness, structured redacted logs, request/run outcome metrics, safe correlation IDs, alert thresholds from observed staging behavior, and named escalation owners.
  - Document how Admin support uses safe job metadata without video or raw model access.
  - _Requirements: R7, R8, NFR-6_

- [ ] 12.7 Exercise release, rollback, restore, and incident procedures (3-4 hours)
  - Deploy a release candidate, run migration/smoke checks, exercise application rollback or forward recovery, restore a non-production backup, rotate a secret, revoke a session, and handle a failed run.
  - Record timings, owners, evidence, and any launch blocker.
  - _Requirements: NFR-2, NFR-4, NFR-6_

- [ ] 12.8 Run permissioned staging acceptance (3-4 hours)
  - Demonstrate provisioned sign-in, assigned child, upload, leave/return processing, review actions and conflict recovery, incomplete/complete summary, finalization/reopen, Admin deactivation/unassignment, and failed-run retry.
  - Run all 45 screen-state checks with approved content labels and selected conditional features only.
  - Obtain Educator, Admin, content, scientist, privacy/security, and technical-owner acceptance.
  - _Requirements: R1-R8, NFR-1-NFR-6_

- [ ] 12.9 Complete production handoff and real-data launch gate (2-4 hours)
  - Deliver source, architecture, decision register, environment variables, secret ownership, migration, roster setup, provider contracts, retry/support, backup/restore, rollback, cost ownership, and known limitations.
  - Verify permission, vendor, storage, retention, deletion, incident, identity, and AWS ownership approvals before enabling real child data.
  - Keep unapproved conditional features disabled and record post-pilot decisions separately from version 1 completion.
  - _Requirements: R1-R8, NFR-1-NFR-6_

## Screen Delivery Traceability

| Screen group | Screen IDs | Primary implementation tasks | Verification tasks |
|---|---|---|---|
| Sign-in and access | 01, 10, 11, 15, 40 | 3.1-3.5 | 11.1, 11.3, 11.4, 12.8 |
| Assigned children | 02, 12, 13, 34 | 4.1-4.3, 4.6 | 4.7, 11.3, 11.4 |
| Child detail/assessments | 14, 16 | 4.1, 4.4, 4.5 | 4.7, 11.4 |
| Upload | 03, 17, 18, 19, 20, 35 | 5.1-5.7 | 5.8, 11.3, 11.4 |
| Processing | 04, 21, 22, 36 | 6.1-6.7 | 6.8, 11.5, 12.4 |
| Review desktop/states | 05, 23, 24, 25, 26, 44 | 7.1-7.5, 8.1-8.6 | 7.6, 8.10, 11.4 |
| Review responsive | 37, 38, 42 | 8.3, 8.4, 8.7-8.9 | 8.10, 11.3, 11.4 |
| Summary/final desktop | 06, 07, 27 | 9.1-9.5 | 9.7, 11.4 |
| Summary/final responsive | 39, 41, 43 | 9.6 | 9.7, 11.3, 11.4 |
| Admin access | 08, 28, 29, 30, 31 | 10.1-10.5 | 10.10, 11.1, 11.4 |
| Admin processing jobs | 09, 32, 33, 45 | 10.6-10.9 | 10.10, 11.4, 12.4 |

## Delivery Checkpoints

### Checkpoint A: Contracts And Clean Boundary

Tasks 1-2 complete. Every external decision has an owner/evidence record; the lean schema, service boundaries, shared UI primitives, and 45 deterministic fixtures are ready; legacy workbench scope is absent.

### Checkpoint B: Secure Intake

Tasks 3-5 complete. The selected identity path, assignment-aware navigation, assessment draft, permission gate, and private single-video upload pass desktop/mobile and direct-request tests.

### Checkpoint C: Durable Processing And Human Review

Tasks 6-8 complete. Processing survives browser exit, invalid output is never shown partially, and all review/video/save/conflict states work across desktop, tablet, and mobile.

### Checkpoint D: Final Record And Pilot Operations

Tasks 9-10 complete. Summary invariants, idempotent finalization, read-only records, pilot access, assignments, and failed-run recovery are production-functional.

### Checkpoint E: Production Acceptance

Tasks 11-12 complete. Security, privacy, accessibility, visual, resilience, provider, deployment, ownership, staging, and real-data launch gates pass with no unresolved conditional feature accidentally exposed.

## Completion Rule

The platform is complete only when all unchecked tasks are complete, every accepted screen ID has a passing deterministic state and route-level behavior, the selected live provider contracts pass in organization-owned staging/production, all summary and authorization invariants hold under direct/concurrent requests, and the real-data approvals are recorded. Generated images alone, the local file-backed spike, or a successful happy-path demo do not satisfy production completion.
