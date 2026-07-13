# Requirements: Assessment Reliability Workbench

Generated with the Kiro spec-driven workflow.

Source documents:
- `docs/RFP.md`
- `docs/refined-milestones-plan.md`
- `docs/meeting-transcripts/May-27.md`
- `docs/meeting-transcripts/May-27-contract-winning-action-points.md`
- Existing prototype files and documentation

## Overview

The Assessment Reliability Workbench is an AI-assisted video analysis MVP for the HELP early childhood assessment. It processes child observation videos in batches, scopes HELP skills by child age and metadata, generates structured skill detection and scoring suggestions, supports trained human review, and measures AI-human agreement against calibrated expert raters.

The tool must be positioned as decision support. It should surface likely observed skills, evidence, confidence, and scoring suggestions, while final assessment judgment remains with trained educators, expert raters, or approved reviewers.

The highest-risk project outcome is reliability. The workflow must therefore make every AI run, prompt iteration, rubric change, human rating, reviewer override, and reliability calculation traceable enough to support a credible path toward the RFP target of >=90% exact agreement on an agreed held-out validation set. Because the permissioned video set may be small and HELP scoring includes professional judgment, reliability claims must always be tied to a specific dataset split, metric, and validation protocol.

## Roles

- **Operator:** Imports child metadata, registers videos, starts batch processing, monitors job status, and exports results.
- **Educator Reviewer:** Reviews AI suggestions as decision support and can accept, revise, or reject them.
- **Expert Rater:** Provides benchmark human ratings for reliability analysis, ideally without exposure to AI outputs.
- **Content Advisor:** Clarifies HELP rubric rules, scoring nuance, age gates, DAL logic, cultural and disability-informed interpretation, and prompt changes.
- **Research Admin:** Manages dataset splits, reliability reports, prompt experiments, validation runs, and milestone evidence.
- **Engineer:** Maintains the system, AI provider boundary, storage, APIs, exports, and deployment path.

## Functional Requirements

### FR-1 Intake, Permissions, and Dataset Management

**User Story:** As a research admin, I want to track videos, child metadata, permissions, and dataset splits, so that tuning and validation are defensible.

**Acceptance Criteria:**
1. WHEN a video is registered THEN the system SHALL store video ID, file reference, child match state, observation metadata, permission status, dataset split, and processing status.
2. WHEN child metadata is imported THEN the system SHALL validate required fields including external child ID, age at observation or age derivation inputs, and any available IFSP/disability support indicators needed for interpretation.
3. IF a video does not have permission for AI tuning, modeling, or validation THEN the system SHALL prevent use outside its approved purpose.
4. WHEN a dataset split is assigned THEN the system SHALL distinguish training/tuning, calibration, and held-out validation sets.
5. WHEN metadata validation fails THEN the system SHALL return row-level errors and SHALL NOT silently accept invalid records.
6. WHEN video-child matching fails THEN the system SHALL mark the video as unmatched and surface it for operator correction.
7. WHEN a batch is registered THEN the system SHALL show counts for matched, unmatched, permission-blocked, and ready-to-process videos.

### FR-2 HELP Rubric, Skill Scope, and Scoring Rules

**User Story:** As a content advisor, I want HELP skills and scoring rules represented as structured data, so that AI and human ratings use the same assessment frame.

**Acceptance Criteria:**
1. WHEN HELP rubric data is imported THEN the system SHALL store skill code, domain, strand, definition, age range, scoring guidance, and any relevant interpretation constraints.
2. WHEN a video is associated with a child age THEN the system SHALL derive an age-gated candidate skill scope instead of passing all 700+ HELP skills to the model.
3. WHEN the system prepares model context THEN it SHALL include only the relevant skill scope plus scoring definitions for present, emerging, not present, atypical development indicators, circled/family-discussion flags, and DAL logic where applicable.
4. IF a skill has missing age gates, definitions, or scoring rules THEN the system SHALL exclude it from production scoring until reviewed.
5. WHEN rubric data changes THEN historical AI runs and reliability reports SHALL remain interpretable against the rubric version used at the time.
6. WHEN the model assigns a score THEN the score SHALL map to the approved normalized credit taxonomy used for reliability comparison.

### FR-3 Batch AI Video Processing

**User Story:** As an operator, I want to process multiple videos without hand-running a prompt for each one, so that the prototype replaces the current manual Gemini workflow.

**Acceptance Criteria:**
1. WHEN an operator starts a batch THEN the system SHALL create one processing job per eligible video and preserve batch-level status.
2. WHEN processing starts for a video THEN the system SHALL create an AI run tied to video, child metadata, rubric version, prompt version, model name, and model configuration.
3. WHEN the AI provider returns output THEN the system SHALL validate the response against a structured schema before saving normalized detections.
4. WHEN validation succeeds THEN the system SHALL store skill ID, domain, strand, suggested credit, confidence, evidence note, timestamp where available, rationale, review flags, and DAL fields where applicable.
5. IF provider output fails schema validation THEN the system SHALL mark the run failed and preserve diagnostic details without treating partial detections as valid.
6. IF processing fails transiently THEN the system SHALL allow retry while preserving prior failed attempts.
7. WHEN a detection is low-confidence, unsupported by evidence, age-gate-questionable, or score-ambiguous THEN the system SHALL flag it for human review.
8. WHEN multiple runs exist for a video THEN the system SHALL allow comparison by prompt version and model configuration.

### FR-4 Prompt and Model Experiment Versioning

**User Story:** As a research admin, I want every prompt/model experiment versioned with before/after metrics, so that reliability improvement is auditable.

**Acceptance Criteria:**
1. WHEN a prompt version is created THEN the system SHALL store prompt text, version label, model name, model configuration, structured output schema version, author, date, and change notes.
2. WHEN a prompt version is used in an AI run THEN it SHALL become immutable for historical traceability.
3. WHEN a new prompt is derived from a prior version THEN the system SHALL preserve parent/version context and the hypothesis behind the change.
4. WHEN a prompt experiment is evaluated THEN the system SHALL attach before/after reliability metrics to that version.
5. WHEN an admin promotes a prompt to current THEN the system SHALL record the promotion and preserve prior versions.
6. IF a prompt lacks required structured output constraints or rubric grounding THEN the system SHALL prevent promotion for scoring.

### FR-5 Human-in-the-Loop Review

**User Story:** As a trained reviewer, I want to inspect AI-generated skill suggestions next to evidence and rubric definitions, so that I can apply professional judgment.

**Acceptance Criteria:**
1. WHEN a reviewer opens a review item THEN the system SHALL show video reference, child context, suggested skills, credit assignments, confidence, evidence, rationale, and review flags.
2. WHEN a reviewer selects a detection THEN the system SHALL show the relevant HELP skill definition, scoring guidance, and any imported benchmark human rating if visible for that workflow.
3. WHEN a reviewer accepts a suggestion THEN the system SHALL record reviewer identity, timestamp, accepted credit, and prompt version.
4. WHEN a reviewer changes a suggestion THEN the system SHALL record original credit, corrected credit, reason/note, reviewer identity, and timestamp.
5. WHEN a reviewer removes an incorrect detection or adds a missing skill THEN the system SHALL log the action in an exportable correction format.
6. WHEN the workflow is used for independent reliability rating THEN the system SHALL support hiding AI outputs from raters.
7. WHEN review data is exported THEN it SHALL include AI output, reviewer corrections, and enough references to support future prompt iteration or fine-tuning.

### FR-6 Reliability Benchmarking and Error Analysis

**User Story:** As a research admin, I want AI outputs compared against expert ratings, so that the team can measure and improve agreement.

**Acceptance Criteria:**
1. WHEN expert ratings are imported THEN the system SHALL validate video IDs, skill IDs, rater IDs, credit assignments, and dataset split.
2. WHEN AI and expert scores exist for the same video-skill pair THEN the system SHALL create comparison rows for reliability analysis.
3. WHEN reliability is calculated THEN the system SHALL report exact agreement, total comparisons, agreed comparisons, disagreement count, and target status.
4. WHEN sample size supports it THEN the system SHALL calculate Cohen's kappa, Krippendorff's alpha, confusion matrices, and grouped metrics by domain, strand, score type, prompt version, and dataset split.
5. WHEN exact agreement is evaluated against the RFP target THEN the system SHALL calculate it separately on the agreed held-out validation set.
6. WHEN agreement is below target THEN the system SHALL surface top error patterns, including missed skill detection, false positives, present vs emerging mismatch, emerging vs not present mismatch, age-gating errors, evidence gaps, and DAL calculation issues.
7. WHEN agreement reaches or exceeds 90% under the agreed validation protocol THEN the system SHALL mark the validation target as met and preserve the evidence for handoff.
8. IF the target is not reached THEN the system SHALL produce a gap analysis that separates data limitations, scoring ambiguity, prompt/model limitations, and implementation issues.

### FR-7 Dashboard, Milestone Evidence, and Reporting

**User Story:** As a stakeholder, I want a concise dashboard and reports, so that progress toward the RFP milestones is visible.

**Acceptance Criteria:**
1. WHEN a user opens the dashboard THEN the system SHALL show total videos, processed videos, videos needing review, latest prompt version, current agreement, and target status.
2. WHEN batch processing is active THEN the system SHALL show job status, failure counts, and retryable items.
3. WHEN review workload exists THEN the system SHALL show queue counts and priority reasons.
4. WHEN prompt experiments exist THEN the system SHALL show reliability trend by prompt version.
5. WHEN a milestone is reached THEN the system SHALL provide exportable evidence aligned to the milestone deliverables.
6. WHEN a report is generated THEN it SHALL state the dataset split, metric definition, prompt version, model configuration, and date of calculation.

### FR-8 Exports and Interoperability

**User Story:** As an engineer, I want stable exports and API-shaped records, so that the MVP can later integrate with Acelero's internal assessment system.

**Acceptance Criteria:**
1. WHEN AI outputs are exported THEN the system SHALL produce CSV and JSON formats containing raw data audit fields needed for analysis.
2. WHEN human ratings are exported THEN the system SHALL preserve independent rater data separately from review overrides.
3. WHEN review overrides are exported THEN the system SHALL include the original AI suggestion, corrected value, reviewer note, and prompt/model references.
4. WHEN reliability reports are exported THEN the system SHALL include comparison counts, metrics, grouped results, and top disagreement patterns.
5. WHEN API routes receive input THEN the system SHALL validate payloads with shared schemas.
6. WHEN API routes return data THEN field names SHALL be stable and aligned with the domain model.
7. WHEN future integration is planned THEN the system SHALL support API or file-based handoff without requiring a rewrite of the scoring pipeline.

### FR-9 Access Control, Privacy, and Auditability

**User Story:** As an admin, I want role-aware controls and audit records, so that child data and assessment decisions are protected.

**Acceptance Criteria:**
1. WHEN authentication is enabled THEN the system SHALL identify the user behind imports, exports, AI runs, prompt changes, and review actions.
2. WHEN a user attempts a restricted action without the required role THEN the system SHALL deny the action.
3. WHEN child data is displayed THEN the system SHALL show only the fields needed for matching, scoring, review, and reliability analysis.
4. WHEN provider credentials or secrets are needed THEN the system SHALL load them from server-side environment configuration and SHALL NOT expose them to client code.
5. WHEN outputs, overrides, prompt changes, or reliability reports are created THEN the system SHALL store audit metadata sufficient to reconstruct who did what and when.
6. WHEN permission status prevents a video from being used for a purpose THEN the system SHALL respect that restriction in processing, experiments, and validation.

### FR-10 Documentation and Handoff

**User Story:** As Acelero's internal team, I want clear documentation and handoff materials, so that the MVP can be evaluated, operated, and extended after delivery.

**Acceptance Criteria:**
1. WHEN final delivery occurs THEN the system SHALL include technical documentation for architecture, data model, AI provider integration, prompt versioning, exports, and deployment.
2. WHEN prompt iterations occur THEN the prompt version log SHALL include change notes, tested dataset, before/after metrics, and known failure modes.
3. WHEN operators need to run the workflow THEN the operator guide SHALL explain video registration, metadata import, batch processing, review, reliability reporting, and exports.
4. WHEN final validation completes THEN the handoff package SHALL include the final reliability report, validation assumptions, limitations, and recommended next steps.

## Non-Functional Requirements

### NFR-1 Traceability

1. WHEN any AI output, human rating, override, prompt version, or reliability report is stored THEN it SHALL retain references to video, child, skill, dataset split, rubric version, prompt version, and model configuration where applicable.
2. WHEN a historical report is viewed THEN the system SHALL show the metrics in the context in which they were calculated.

### NFR-2 Reliability-First Delivery

1. WHEN implementation choices compete for time THEN the system SHALL prioritize the path that improves or measures AI-human agreement before dashboard polish.
2. WHEN prompt/model changes are made THEN they SHALL be evaluated through structured experiments rather than anecdotal inspection alone.
3. WHEN scoring ambiguity appears THEN it SHALL be escalated to the content advisor instead of hidden in code or prompt assumptions.

### NFR-3 Performance and Scalability

1. WHEN processing a batch of videos THEN long-running work SHALL run through a job boundary rather than blocking an interactive request in production.
2. WHEN list or dashboard pages render THEN they SHALL avoid downloading full video files or raw AI payloads.
3. WHEN the AI runner is implemented THEN it SHALL remain separate from UI components so it can move to a worker later if needed.

### NFR-4 Security and Privacy

1. WHEN storing child and video data THEN the system SHALL use the minimum necessary fields for the MVP.
2. WHEN exporting data THEN the export scope SHALL be explicit.
3. WHEN real child videos or metadata are used THEN the system SHALL follow the permission and privacy constraints provided by Acelero.

### NFR-5 Usability and Accessibility

1. WHEN users navigate the workbench THEN each page SHALL provide clear loading, empty, success, warning, and error states.
2. WHEN controls are interactive THEN they SHALL be keyboard accessible and have accessible labels.
3. WHEN dense review or reliability data is shown THEN the UI SHALL support scanning through filters, badges, tables, and prioritized queues.

### NFR-6 Milestone Constraints

1. WHEN planning delivery THEN the system SHALL support the June 30 proof-of-concept milestone, July 10 first reliability benchmark, July 15 review interface, July 27 validation, and July 31 handoff.
2. WHEN scope expands THEN changes SHALL be evaluated against the July 31 final delivery deadline.
3. WHEN production architecture choices conflict with MVP speed THEN the system SHALL favor a lean Next.js monolith while preserving clean boundaries for storage, AI provider, reliability logic, and exports.

## Out of Scope for Initial MVP

- Replacing trained human judgment with autonomous final scoring.
- Full enterprise multi-tenant architecture.
- Production-grade custom model training or fine-tuning workflow.
- Native mobile application.
- Full integration into Acelero's existing internal assessment system.
- Synthetic video generation as a primary validation source.
- Guaranteed reliability claims outside the agreed validation set and metric protocol.

