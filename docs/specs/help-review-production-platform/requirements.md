# Requirements: HELP Review Pilot Platform

Generated with the Kiro spec-driven workflow.

## Source Of Truth

The sources are authoritative in this order:

1. The latest explicit stakeholder follow-ups for the subject they address, including the HELP Connect authentication discussion and the July 14 selection of a Google Cloud runtime
2. `docs/meeting-transcripts/July-10-meeting-transcript.md`
3. The HELP Review Lovable prototype at `https://draft-review-helper.lovable.app/` and the supplied screenshot, for review-screen interaction and visual hierarchy only
4. Other decisions explicitly confirmed after the meeting, including the two core application roles
5. Earlier RFP, milestone, and reliability-workbench documents, for background only

The July 10 meeting describes a scope change and therefore supersedes conflicting earlier material. The later authentication exchange supersedes the earlier magic-link preference: the preferred path is to reuse HELP Connect's current sign-in when practical, with administrator-provisioned email/password as the fallback. The July 14 engineering decision selects Google Cloud Run, Cloud Storage, Eventarc, Vertex AI, and Secret Manager as the deployable runtime, with Neon PostgreSQL retained behind Prisma for the current development environment. Final organization ownership still requires acceptance.

The Lovable prototype is not a complete application: it does not define authentication, child assignment, upload, durable processing, persistence, or production infrastructure, and some of its visible controls are placeholders. Prototype behavior SHALL NOT become a requirement unless it matches the meeting or is explicitly listed here.

The 45 accepted images in `ui-ux-screens/` are state and interaction references for this specification. They define the intended information hierarchy, responsive composition, feedback states, and available commands, but they do not override security, privacy, content, or integration decisions in this document. A visible control in an image SHALL be implemented only when its underlying behavior is required here. Conditional content is hidden until its contract is approved; discarded drafts in `ui-ux-screens/_rejected/` are not part of the product.

## Product Outcome

The pilot is a small standalone web application that lets an approved educator:

1. Sign in.
2. Choose a child already assigned to them.
3. Upload one short observation video.
4. Wait while the scientist-owned service analyzes it.
5. Review and correct the proposed HELP skill credits using the video evidence.
6. Confirm a final human-approved summary.

The application is decision support. The AI drafts suggestions; the educator makes the final assessment decisions. The application must remain easy to integrate into Acelero's existing assessment platform later.

## Roles And Access

Version 1 has only two application roles:

- **Educator:** Can access assigned children, upload a video, review AI suggestions, and finalize an assessment.
- **Admin:** Can provision or deactivate pilot access, manage educator-child assignments, and resolve failed pilot processing when needed.

An Educator role alone does not grant access to all children. Access also requires an active child assignment. The Admin role does not automatically grant video playback or assessment-review access.

`Operator`, `Expert Rater`, `Content Advisor`, `Research Admin`, `Scientist`, and `Engineer` are not application roles in this pilot. The scientist interacts through the scoring-service contract. Engineering and cloud access are managed outside the application.

Children and family members do not receive accounts.

## Scoring Terminology

The provisional primary credit values shown in the Lovable review are:

- `PRESENT`: `+ Present`
- `EMERGING`: `+/− Emerging`
- `NOT_OBSERVED`: `− Not observed`
- `NOT_APPLICABLE`: `N/A`

The sources are inconsistent on the negative label: the meeting says `not present`, the prototype section says `Not observed`, and its score button says `Absent`. The content owner must choose one user-facing label before release; the implementation SHALL NOT use all three interchangeably.

An uncertain suggestion may have no AI-drafted primary credit and must be scored independently by the educator.

The prototype also shows the add-on flags `ATYPICAL` and `FAMILY_CONCERN`. Their final names, symbols, and rules require content-owner confirmation before implementation; they are stored separately from the primary credit if approved.

## Functional Requirements

### R1. Provisioning, Sign-In, And Authorization

**User Story:** As an admin, I want only approved staff to enter the pilot through an authentication path that can transfer into HELP Connect and the organization-owned Google Cloud environment, so that child records are protected without creating a disposable identity system.

**Acceptance Criteria:**

1. BEFORE implementing live authentication, the team SHALL document HELP Connect's current sign-in provider or protocol, stable user identifier, session/logout behavior, account lifecycle, available non-production environment, and integration owner.
2. WHEN HELP Connect authentication is available and approved for the pilot THEN the system SHALL reuse it and map the authenticated identity to the pilot's local role and child assignments without collecting a second password.
3. IF HELP Connect authentication cannot support the standalone pilot within the agreed schedule THEN the system SHALL use administrator-provisioned email/password through an approved managed identity service that is compatible with the target Google Cloud ownership model.
4. WHEN an Admin provisions a staff member THEN the system SHALL create or activate pilot access for the exact external identity or email and either the `EDUCATOR` or `ADMIN` role.
5. IF the email/password fallback is selected THEN the identity service SHALL support secure initial setup, email verification where required, password recovery, session revocation, rate limiting, and protection against brute-force and credential-stuffing attempts.
6. WHEN a person without provisioned pilot access attempts sign-in or recovery THEN the system SHALL not grant access or disclose whether a pilot account exists.
7. WHEN the selected identity provider confirms a valid user THEN the system SHALL establish a secure application session or validate the provider session on each protected request.
8. WHEN an Educator requests child or assessment data THEN the system SHALL require an active assignment to that child.
9. WHEN an Admin deactivates a user or assignment THEN the system SHALL deny subsequent access and invalidate or reject incompatible active sessions.
10. IF a user requests an unauthorized resource THEN the system SHALL return a non-disclosing forbidden or not-found response.

The pilot SHALL implement only the selected sign-in method, not parallel HELP Connect, password, and magic-link systems. Magic links are not the default requirement and SHALL NOT be implemented unless HELP Connect already uses them or stakeholders explicitly select them later. Public signup and self-service account creation are not part of the pilot. The application SHALL NOT build a custom password store when the approved identity service can own credentials.

### R2. Assigned Child Selection

**User Story:** As an educator, I want to select from children already assigned to me, so that I can start the correct assessment without entering a full child record.

**Acceptance Criteria:**

1. WHEN an Educator opens the application THEN the system SHALL show only active children assigned to that Educator.
2. WHEN a child is listed THEN the system SHALL show the minimum context needed to select the correct record, including the approved child identifier and age.
3. WHEN disability, IFSP, or other assessment context is approved and required for interpretation THEN the system SHALL show only the authorized fields needed by the workflow.
4. WHEN an Educator opens an unassigned child URL directly THEN the system SHALL not reveal whether that child exists.
5. WHEN no children are assigned THEN the system SHALL show a clear empty state directing the Educator to the pilot administrator.

The minimal Admin flow in R7 manages pilot access and assignment of existing child records. The initial child roster SHALL come from the agreed upstream source or controlled import. Creating and maintaining full child records is not part of the Admin UI, and a general roster-management product is not required unless Acelero confirms it through a requirements change.

### R3. Single-Video Assessment Intake

**User Story:** As an educator, I want to upload one observation video for a selected child, so that the scoring service can prepare a draft review.

**Acceptance Criteria:**

1. WHEN an Educator starts an assessment THEN the system SHALL bind it to the authorized child and observation date.
2. WHEN the workflow requires age or approved disability/support context THEN the system SHALL attach the minimum required child context to the assessment.
3. WHEN an Educator chooses a video THEN the system SHALL validate it against the file types, size, and duration accepted by the confirmed scoring and storage contract.
4. WHEN upload is in progress THEN the system SHALL show progress and a recoverable failure state.
5. WHEN upload succeeds THEN the system SHALL store a private video reference and allow the Educator to start processing.
6. WHEN upload fails THEN the system SHALL preserve the assessment draft and allow retry or replacement.
7. IF the child's permission status does not allow the proposed processing THEN the system SHALL block submission and direct the Educator to an Admin.

The expected pilot input is one approximately three-to-five-minute video at a time. Batch upload and batch processing are not required.

### R4. Scientist-Owned Scoring Integration

**User Story:** As an educator, I want processing to continue after upload, so that I can leave and return while the video is analyzed.

**Acceptance Criteria:**

1. WHEN an Educator submits an uploaded video THEN the system SHALL create a processing run and call the confirmed scientist-owned scoring interface.
2. WHEN the scoring request is sent THEN the system SHALL include only the video reference, child context, and identifiers required by the agreed contract.
3. WHEN processing is queued or running THEN the system SHALL show a durable status that survives navigation and refresh.
4. WHEN processing completes successfully THEN the system SHALL validate and store the returned suggestions before showing them to the Educator.
5. WHEN the response contains an unknown credit, malformed skill, or invalid evidence timestamp THEN the system SHALL reject the invalid result rather than display a partial valid-looking draft.
6. WHEN processing fails THEN the system SHALL show a safe failure message and allow an authorized retry without requiring another upload when the existing video remains available.
7. WHEN a retry occurs THEN the system SHALL preserve the earlier attempt for troubleshooting and avoid duplicating review items.

The web application SHALL NOT edit or execute the scientist's prompts or model code. Whether completion uses polling, a callback, or another mechanism is decided by the scientist API contract, not invented in this specification.

### R5. Educator Review Workspace

**User Story:** As an educator, I want to compare AI suggestions with the video and correct them, so that the final record reflects my professional judgment.

**Acceptance Criteria:**

1. WHEN an assessment is ready THEN the system SHALL show the video, approved child context, review progress, and all returned skill suggestions.
2. WHEN suggestions have drafted credits THEN the system SHALL group them by `Present`, `Emerging`, `Not observed`, and `Not applicable` as shown in the Lovable prototype.
3. WHEN the model returns an uncertain suggestion without a credit THEN the system SHALL place it in `Needs your review` and require the Educator to choose a credit independently.
4. WHEN a suggestion is displayed THEN the system SHALL show its skill code, name, domain/strand when supplied, AI draft or uncertainty state, and available evidence.
5. WHEN evidence timestamps are supplied THEN activating a timestamp SHALL seek the video to the corresponding moment.
6. WHEN the Educator expands `What the AI noticed` THEN the system SHALL show the supplied evidence explanation without changing the decision.
7. WHEN the Educator accepts a draft THEN the system SHALL save the drafted primary credit as the Educator's decision and record that it was accepted.
8. WHEN the Educator changes a drafted credit THEN the system SHALL save the final credit and record the decision as overridden.
9. WHEN the Educator scores an uncertain item THEN the system SHALL save the selected credit and record that it was scored independently.
10. WHEN the Educator adds or edits a note THEN the system SHALL save the note with the corresponding decision.
11. WHEN the Educator dismisses a suggestion THEN the system SHALL exclude it from the final item list while retaining that it was dismissed.
12. WHEN approved add-on flags are enabled THEN the Educator SHALL be able to apply them without replacing the primary credit.
13. WHEN any decision is saved THEN the system SHALL update visible progress and restore the saved state after refresh or a later session.
14. WHEN saving fails THEN the system SHALL retain the Educator's visible input and offer retry without falsely showing it as saved.
15. WHEN the viewport is narrow THEN the video, item list, and editor SHALL remain usable without overlapping or clipped controls.

Adding a rubric skill that the model did not return is not required unless the content owner explicitly confirms that workflow.

### R6. Finish Review And Final Summary

**User Story:** As an educator, I want to review the completed results before finalizing, so that I can catch mistakes and create a human-approved record.

**Acceptance Criteria:**

1. WHEN any AI suggestion is still unactioned THEN the system SHALL identify the remaining items and prevent final confirmation.
2. WHEN every suggestion has an action THEN the system SHALL show a summary containing the final item list and per-domain credit counts.
3. WHEN the summary is shown THEN the system SHALL identify which items were accepted, overridden, scored independently, or dismissed.
4. WHEN the Educator returns from the summary to the review THEN the system SHALL preserve all saved decisions.
5. WHEN the Educator confirms finalization THEN the system SHALL mark the assessment final, record the Educator and time, and prevent ordinary edits.
6. WHEN a finalized assessment is opened THEN the system SHALL show its human-approved summary.

The meeting requires a final page/report, but it does not confirm a downloadable PDF. The on-screen final summary satisfies version 1 unless Acelero explicitly requests another format.

### R7. Minimal Administration

**User Story:** As an admin, I want the minimum controls needed to run the pilot, so that educators are not blocked without building a second operational product.

**Acceptance Criteria:**

1. WHEN an Admin manages access THEN the system SHALL support provisioning, deactivating, and viewing the status of Educator pilot access; credential lifecycle remains with the selected identity provider.
2. WHEN an Admin manages assignments THEN the system SHALL support assigning and unassigning Educators to children.
3. WHEN a processing run fails THEN the system SHALL let an Admin inspect a safe error category and retry or mark it for technical follow-up.
4. WHEN the agreed roster source is an import THEN the system SHALL validate required child and assignment fields and report row errors.
5. WHEN an Admin action changes access or processing state THEN the system SHALL record the Admin and time.

A dashboard, batch console, prompt manager, reliability workspace, generalized rubric editor, and export center are not part of the confirmed Admin scope.

### R8. Privacy And Basic Auditability

**User Story:** As the pilot owner, I want child data and review decisions protected, so that the workflow can be used only for its approved purpose.

**Acceptance Criteria:**

1. WHEN child data is stored or displayed THEN the system SHALL use the minimum fields required for assignment, scoring, and review.
2. WHEN a video is stored THEN it SHALL remain private and SHALL be delivered only after an authorization check.
3. WHEN a user views a video, changes a decision, retries processing, or finalizes an assessment THEN the system SHALL retain the user and time needed to reconstruct the action.
4. WHEN secrets, access tokens, or temporary video URLs are used THEN the system SHALL keep them out of browser-visible configuration and application logs.
5. WHEN application logs are written THEN they SHALL avoid child names, raw video data, passwords, recovery or provider tokens, session secrets, and unrestricted model responses.
6. BEFORE real child data is enabled THEN Acelero SHALL confirm the allowed video use, required permission check, storage location, retention period, deletion procedure, and approved vendors.

This requirement defines technical safeguards, not a claim of legal compliance.

## Cross-Screen Interaction Requirements

These requirements apply to every route and state represented in the accepted screen set.

1. WHEN a protected page begins loading THEN the system SHALL reserve the stable page structure, expose a programmatically determinable loading status, and prevent duplicate commands until the required state is known.
2. WHEN a collection contains no records THEN the system SHALL distinguish a legitimate empty state from a request failure and provide the next valid action.
3. WHEN a recoverable request fails THEN the system SHALL preserve the user's valid local or server state, show a safe explanation, and offer a retry that does not duplicate the original operation.
4. WHEN a user starts a destructive or access-reducing Admin action THEN the system SHALL show the affected staff member, child assignment, or processing run and require explicit confirmation before mutation.
5. WHEN a mutation succeeds THEN the system SHALL update the authoritative state, announce the result, and prevent accidental repeat submission.
6. WHEN a mutation fails THEN the system SHALL not present the attempted value as saved.
7. WHEN an authorization check fails THEN the system SHALL use the generic resource-unavailable treatment and SHALL NOT reveal the existence, owner, child identifier, assessment state, or video state of the protected record.
8. WHEN the same assessment is edited from stale state THEN the system SHALL stop the write, preserve both the local attempt and current server value, and require an explicit reconciliation choice.
9. WHEN the selected identity session expires during a protected workflow THEN the system SHALL retain only a safe return destination and SHALL restore the authorized workflow state after successful sign-in without storing credentials or protected payloads in the return URL.
10. WHEN the viewport changes among supported desktop, tablet, and mobile widths THEN the system SHALL preserve the same permissions, data, decisions, validation, and recovery actions even when the composition changes.

## Screen-Level Acceptance Catalogue

Every accepted screen is an acceptance state of an existing route, not a separate product module. The image identifier is used by design, implementation, and visual tests.

### Authentication And Protected Access

| Screen | Required acceptance behavior |
|---|---|
| `01-sign-in.png` | IF managed email/password is the selected identity path THEN `/sign-in` SHALL provide email, password visibility control, sign-in, and provider-owned recovery entry points; WHEN credentials or access are rejected THEN it SHALL use the safe failure in screen 10. IF HELP Connect reuse is selected THEN this form SHALL be replaced by the approved provider handoff rather than shipped as a second mode. |
| `10-auth-access-unavailable.png` | WHEN sign-in, recovery, or pilot-access mapping fails THEN the system SHALL show one non-enumerating response, retain the entered email only when approved by the provider flow, clear the password, and offer the selected recovery or Admin-contact path without identifying which check failed. |
| `11-session-expired.png` | WHEN an active session expires THEN the system SHALL interrupt protected requests, avoid saving the failed command as successful, show the safe assessment reference already visible to the user, and allow reauthentication followed by authorization-checked resume. |
| `15-resource-unavailable.png` | WHEN a child, assessment, video, or final record is missing or unauthorized THEN the system SHALL show the same generic unavailable state and a route back to assigned children; it SHALL NOT distinguish missing from forbidden. |
| `40-mobile-sign-in.png` | IF the managed fallback is selected and the viewport is mobile THEN all sign-in, password visibility, recovery, privacy, help, error, and focus behavior from screen 01 SHALL remain usable without horizontal scrolling or obscured controls. |

### Assigned Children And Assessment Navigation

| Screen | Required acceptance behavior |
|---|---|
| `02-assigned-children.png` | WHEN assigned children load THEN `/children` SHALL show only active assignments with approved child identifier, age, most recent observation, current assessment state, and exactly the next valid action for that row. Search SHALL filter only the already authorized result set. |
| `12-assigned-children-empty.png` | WHEN the authorized assignment result is empty THEN the system SHALL state that no children are assigned, provide assignment refresh, and direct the Educator to the pilot Admin without exposing roster data. |
| `13-children-load-error-v2.png` | WHEN the child list cannot be loaded because of a transient application or network failure THEN the system SHALL distinguish it from the empty state, show no stale roster as current, and provide retry plus safe sign-out. |
| `14-child-detail-history-v2.png` | WHEN an Educator opens an assigned child THEN `/children/[childId]` SHALL show the minimum approved context and that child's authorized assessment history, using state-specific row actions such as continue upload, view status, continue review, or view final. |
| `16-assessments-list.png` | WHEN an Educator opens `/assessments` THEN the system SHALL list only their authorized assessments, support active/finalized/all filtering and safe search, show progress and last-updated metadata, and route each record to its state-valid next action. |
| `34-mobile-assigned-children.png` | WHEN `/children` is used on mobile THEN each assignment SHALL remain scannable with identifier, age, state, and one next action; filters, help, account actions, and missing-assignment guidance SHALL remain reachable without converting the workflow into a different feature set. |

### Intake And Upload

| Screen | Required acceptance behavior |
|---|---|
| `03-upload-observation.png` | WHEN an approved file is uploading THEN `/assessments/new?childId=...` SHALL show the bound child context, observation date, filename, byte progress, upload status, and only contract-supported cancel or save-and-exit behavior; processing SHALL remain disabled until completion. |
| `17-upload-ready.png` | WHEN upload validation and storage completion succeed THEN the system SHALL show the stored file metadata, allow replacement or removal before submission, enable `Start processing`, and make repeated submission idempotent. |
| `18-upload-validation-error.png` | WHEN client or server validation rejects type, size, duration, or integrity THEN the system SHALL identify the applicable approved limit, avoid creating an available video asset, preserve the draft/date, and let the Educator choose another file. |
| `19-upload-network-failure.png` | WHEN transfer is interrupted THEN the system SHALL show that the upload is not complete, preserve the draft and any resumable upload identifier supported by the storage contract, and offer retry, replace, or remove without producing duplicate assets. |
| `20-permission-blocked.png` | WHEN the child's processing permission is not approved THEN the system SHALL prevent upload submission and processing, identify only the safe permission status, and provide cancel/return and Admin-contact guidance. |
| `35-mobile-upload.png` | WHEN intake is used on mobile THEN child context, observation date, upload completion, file replacement/removal, privacy status, save-and-exit, and processing submission SHALL remain reachable and keyboard/screen-reader operable without clipped controls. |

### Processing

| Screen | Required acceptance behavior |
|---|---|
| `04-processing.png` | WHEN a run is queued or running THEN `/assessments/[id]/processing` SHALL show durable completed/current/pending steps, the uploaded filename, last status time, leave-and-return guidance, and a lightweight refresh action without fabricating completion time. |
| `21-processing-failed.png` | WHEN a run reaches a retryable terminal failure THEN the system SHALL show a safe category, retain the available video, preserve the failed attempt, and allow an authorized idempotent retry that creates a new attempt. |
| `22-processing-ready.png` | WHEN a complete result passes validation and is stored THEN the system SHALL show ready status, validated suggestion and needs-review counts, and one route to start or resume review. |
| `36-mobile-processing.png` | WHEN processing is viewed on mobile THEN the same durable steps, file identity, last-known state, refresh, and return-to-children actions SHALL remain available without requiring the page to stay open. |

### Review Workspace

| Screen | Required acceptance behavior |
|---|---|
| `05-review-workspace.png` | WHEN a valid review projection loads on desktop THEN `/assessments/[id]/review` SHALL show progress and group counts, grouped skills, selected-item identity, evidence-linked video, four primary credits, approved conditional flags, note, dismiss, save, and summary entry without hiding unsaved state. |
| `23-review-save-failure.png` | WHEN a decision write fails THEN the editor SHALL retain the attempted credit, flags, and note in visibly unsaved state, keep the last saved decision distinguishable, and offer retry or discard/reload without incrementing progress. |
| `24-review-video-unavailable.png` | WHEN a short-lived playback grant expires or video delivery fails THEN the system SHALL preserve the selected skill and unsaved editor state, disable evidence seeking that requires playback, and offer authorized access restoration from the same position. |
| `25-review-conflict-v2.png` | WHEN `expectedRevision` is stale THEN the system SHALL show the current saved value and the local attempted value, prevent automatic overwrite, and allow the Educator to reload the current decision or intentionally reapply the local decision against the new revision. |
| `26-review-no-valid-results.png` | WHEN a scoring result is invalid or contains no valid complete suggestion set THEN the system SHALL show no partial review, display only a safe error category/reference, retain the video/assessment, and offer return or authorized reprocessing. |
| `37-mobile-review-list.png` | WHEN review is used on mobile THEN the page SHALL prioritize progress, usable video, group tabs/sections, skill identity, evidence, current decision, and an explicit editor-opening action; scrolling SHALL not discard selection or playback position. |
| `38-mobile-review-editor.png` | WHEN a mobile item editor is opened THEN it SHALL identify the skill and evidence context, expose exactly one primary credit, conditional flags only when enabled, note, dismiss/discard, and save; unsaved changes SHALL be guarded before navigation. |
| `42-tablet-review-workspace.png` | WHEN review is used at tablet widths THEN grouped items and video/editor SHALL remain simultaneously understandable or switch predictably between panes, with all desktop actions and no overlap. |
| `44-review-loading.png` | WHEN the review projection or playback grant is loading THEN stable skeletons/placeholders SHALL preserve the final layout, a live status SHALL announce loading, and review/finalization commands SHALL remain unavailable until authoritative data is ready. |

### Summary And Finalization

| Screen | Required acceptance behavior |
|---|---|
| `06-finish-review.png` | WHEN every suggestion is actioned THEN `/assessments/[id]/summary` SHALL reconcile total, accepted, overridden, independently scored, and dismissed counts; show domain-by-credit totals and final item details; and provide return-to-review plus explicit final confirmation. |
| `27-summary-incomplete.png` | WHEN one or more suggestions remain unactioned THEN summary SHALL show the exact remaining authorized items and navigation back to each item, keep current totals visible, and disable final confirmation. |
| `07-final-assessment.png` | WHEN finalization succeeds THEN `/assessments/[id]/final` SHALL show read-only status, child/date/finalizer metadata, reconciled decision counts, domain totals, included final skills, dismissed suggestions, and a route back to authorized navigation. |
| `39-mobile-summary.png` | WHEN summary is viewed on mobile THEN progress, decision-origin totals, domain totals, final items, remaining items, return-to-review, and confirmation SHALL remain equivalent using disclosure sections where needed. |
| `41-mobile-final-assessment.png` | WHEN a final record is viewed on mobile THEN its read-only status, finalizer metadata, totals, included/dismissed items, and return navigation SHALL remain available without editable controls or horizontal scrolling. |
| `43-tablet-summary.png` | WHEN summary is viewed at tablet widths THEN domain tables, decision totals, item details, return, and confirmation SHALL remain legible and actionable without truncating the longest approved labels. |

### Minimal Administration

| Screen | Required acceptance behavior |
|---|---|
| `08-admin-pilot-access.png` | WHEN an Admin opens `/admin/access` THEN the system SHALL list provisioned staff and active assignments, support authorized search/filter, and provide provisioning, role/status, assignment, unassignment, and deactivation actions while leaving credentials with the selected identity provider. |
| `28-admin-access-empty.png` | WHEN no pilot access has been provisioned THEN the system SHALL show a legitimate empty state and one `Provision staff` action; it SHALL NOT imply that provider credentials can be created inside the app unless the selected contract requires an application handoff. |
| `29-admin-access-load-error.png` | WHEN access data cannot be loaded THEN the system SHALL show no partial roster as current, make no access changes, expose a safe retry, and retain only non-sensitive filter input. |
| `30-admin-deactivate-confirmation-v2.png` | WHEN an Admin chooses deactivation THEN the system SHALL identify the staff record, summarize session and assignment consequences, require explicit acknowledgement when approved by policy, and apply the change only after confirmation. |
| `31-admin-remove-assignment-v2.png` | WHEN an Admin chooses unassignment THEN the system SHALL identify the Educator and child identifier, explain the immediate access consequence and retained record behavior, and remove only the selected assignment after confirmation. |
| `09-admin-processing-jobs.png` | WHEN failed or stuck jobs exist THEN `/admin/jobs` SHALL support safe filtering, show assessment/child reference, state, safe category, last change, attempts, video availability, and attempt history, and expose retry only when policy permits. |
| `32-admin-jobs-empty-v2.png` | WHEN no failed or stuck runs match the filter THEN the system SHALL show a healthy empty state, last refresh, and a refresh action without presenting successful jobs as failures. |
| `33-admin-retry-confirmation-v2.png` | WHEN an Admin requests retry THEN the system SHALL identify the assessment/run, confirm video availability and retry eligibility, state that a new attempt will be created and history retained, and submit only after explicit confirmation. |
| `45-admin-jobs-load-error.png` | WHEN the jobs query fails THEN the system SHALL distinguish failure from the healthy empty state, show no stale job actions as current, and provide safe retry without changing processing state. |

## Non-Functional Requirements

### NFR-1. Usability And Accessibility

1. The child-selection, upload, processing, review, and summary journeys SHALL support keyboard operation and clear focus states.
2. Credit choices SHALL expose their selected state without relying on color alone.
3. Processing, save, failure, and finalization states SHALL be understandable to assistive technology.
4. The review workflow SHALL remain functional on current desktop, tablet, and mobile browser widths, with desktop/tablet as the primary review experience.

### NFR-2. Data Integrity And Recovery

1. Upload, processing submission, retry, decision save, and finalization SHALL avoid duplicate records when a request is retried.
2. A browser refresh or sign-in return SHALL not lose a completed upload, processing state, or saved review decision.
3. External service failures SHALL result in explicit retryable or terminal states rather than corrupted assessment data.

### NFR-3. Performance

1. Child and review pages SHALL not download raw video bytes or full unrestricted model payloads as part of ordinary page data.
2. Video playback SHALL support seeking to evidence timestamps without requiring the entire video to download first.
3. Multi-minute scoring SHALL run outside the lifetime of an interactive browser request.

### NFR-4. Maintainability And Integration

1. Authentication, video storage, and scientist scoring SHALL be isolated behind small server-side interfaces.
2. External scoring responses SHALL be validated before they enter review state.
3. The standalone pilot SHALL expose a stable final-assessment data shape that can later be mapped into Acelero's existing platform.
4. Development fixtures SHALL use synthetic or sanitized data only.
5. Authentication and deployment configuration SHALL be transferable to the confirmed HELP Connect/Google Cloud owners without depending on a developer's personal account.
6. The selected technology and handoff documentation SHALL support deployment in the confirmed Google Cloud environment without replacing the educator workflow.
7. Each production dependency SHALL have a named technical owner, budget owner, and documented cost/transfer responsibility before pilot handoff.

### NFR-5. Responsive And Visual Integrity

1. The supported web experience SHALL be validated at a minimum content width of 360 CSS pixels, a representative tablet width of 768 CSS pixels, and a representative desktop width of 1280 CSS pixels.
2. Fixed-format controls, progress indicators, tables, video regions, and editor actions SHALL use stable responsive constraints so loading, long labels, validation, or status changes do not cause incoherent overlap or make commands unreachable.
3. Tables MAY become labeled row lists or disclosure sections at narrow widths, but the transformation SHALL preserve every required value, state, and action.
4. Touch targets, focus order, headings, landmarks, field labels, error relationships, dialog focus containment, and status announcements SHALL be verified with automated and manual accessibility checks.
5. Status and credit meaning SHALL use text or an accessible label in addition to color and iconography.

### NFR-6. Operational Supportability

1. Each upload, processing attempt, decision mutation, video-access grant, Admin access change, and finalization SHALL have a safe correlation identifier or record identifier usable for support without exposing secrets or raw child data.
2. Background processing SHALL expose last-known state and update time so the UI can distinguish active, delayed, failed, and stale runs according to the confirmed scientist contract.
3. Production health and error telemetry SHALL exclude protected video content, temporary URLs, provider tokens, credentials, and unrestricted scoring payloads.
4. Retry controls SHALL be enabled from authoritative retry eligibility, not from elapsed browser time alone.

## Explicitly Out Of Scope

- Batch video upload or batch processing
- Reliability dashboards, Cohen's kappa, confusion matrices, or held-out-set management
- Expert-rater or blinded-research workflows
- Prompt editing, prompt experiments, model configuration promotion, or model training
- Rubric authoring and generalized rubric-version administration
- DAL calculation unless Acelero separately supplies and approves it for this pilot
- Manual addition of skills omitted by the model unless explicitly confirmed
- PDF generation, export jobs, or a generalized export center
- Amendment/version-history workflows beyond a single finalized pilot record
- Configurable retention engines, legal-hold tooling, or automated deletion orchestration before the actual policy is confirmed
- Operational dashboards, observability suites, or infrastructure-as-code beyond what the selected deployment requires
- A native mobile application, offline review, live recording, or livestream scoring
- Public signup, billing, or self-service organization management
- Running multiple parallel sign-in systems for the pilot
- A custom application password store when an approved HELP Connect or managed identity service can own credentials
- Full integration with Acelero's existing platform beyond the selected identity and required handoff boundaries in version 1
- Autonomous final assessment decisions

## Scope Traceability

| Requirement | Basis |
|---|---|
| R1 | Latest authentication/Google Cloud ownership follow-up plus the confirmed two-role decision |
| R2 | July 10 assigned-child login flow |
| R3 | July 10 one-video educator upload flow |
| R4 | July 10 scientist-owned model and multi-minute processing discussion |
| R5 | July 10 review actions plus the Lovable session interaction reference |
| R6 | July 10 final-list/report step plus the Lovable summary reference |
| R7 | Minimum support needed for the confirmed access-provisioning, assignment, and retry flow |
| R8 | Necessary safeguards for the child video and demographic data named in the meeting |

The screen-level catalogue refines R1-R8 and NFR-1-NFR-6 into observable route states. It does not create a separate source tier or expand the product beyond those requirements.

A feature without one of these bases requires an explicit requirements change before it enters design or tasks.

## Decisions Required Before Live Integration

1. HELP Connect's current authentication provider/protocol and whether the pilot can reuse its non-production and production identity interfaces.
2. If reuse is not feasible, the approved managed email/password provider and the migration or federation path into HELP Connect.
3. The target Google Cloud organization/project, service and budget ownership, deployment constraints, secret ownership, and handoff expectations.
4. Scientist API request, response, authentication, completion, retry, and error contract.
5. Exact child roster source, identifier, assignment method, and approved context fields.
6. Video permission rule, storage provider/location, upload limits, retention period, and deletion owner.
7. Final scoring response fields, including confidence, evidence, uncertainty boundaries, and add-on flags.
8. Whether the final report is only the on-screen summary or also needs a downloadable or integration format.
9. Whether child records arrive through a controlled pilot import or an upstream integration, including its validation and reconciliation contract; the minimal pilot-access and assignment UI remains in scope.

### Decision-Gate Shipping Rules

| Gate | Until confirmed | After confirmation |
|---|---|---|
| HELP Connect reuse versus managed email/password | Use only a test identity adapter and sanitized users outside production. | Implement and test exactly the selected path; remove or omit the alternative UI and routes. |
| Negative credit wording | Use canonical code `NOT_OBSERVED` internally and mark release content as unresolved. | Apply one approved display label consistently across review, summaries, final records, tests, and accessibility names. |
| `ATYPICAL` and `FAMILY_CONCERN` flags | Hide the flag controls and reject flag values at the production API boundary. | Enable only the approved names, symbols, eligibility, summary behavior, and persistence rules. |
| Child roster source | Use sanitized fixtures or controlled seed data; the Admin UI can assign only those existing records. | Implement the approved controlled import or upstream integration for child records while retaining the minimal access/assignment UI represented by the screens. |
| Manual omitted-skill entry | Do not show an add-skill control and reject manually created review items. | Add it only through a requirements revision that defines rubric source, validation, origin, and summary behavior. |
| Final output format | Ship the authorized on-screen final record only. | Add an integration payload or downloadable artifact only after its schema, authorization, storage, and retention contract is approved. |
| Real child video policy | Keep real child data disabled and use sanitized fixtures. | Enable real data only after permission, vendor, storage, retention, deletion, and incident ownership approvals are recorded. |

## Definition Of Done

Version 1 is done when an approved Educator can sign in through the selected HELP Connect or managed email/password path, see only assigned children, upload one approved video, leave and return during processing, review every valid suggestion using real video evidence, save each supported action, finalize the assessment, and reopen the final summary. An unassigned Educator must be unable to access the child or assessment through either the UI or direct requests. The selected identity and deployment path must have an accepted HELP Connect/Google Cloud ownership handoff, the scientist integration must pass against its agreed sandbox, and the unresolved privacy/storage decisions must be approved before real child data is enabled.
