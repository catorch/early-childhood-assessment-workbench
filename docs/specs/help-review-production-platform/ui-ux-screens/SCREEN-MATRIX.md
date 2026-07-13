# HELP Review UI/UX Screen Matrix

This package visualizes the confirmed HELP Review pilot scope in `requirements.md`
and `design.md`. It includes primary routes, recovery states, authorization states,
administrative confirmations, and responsive review layouts.

## Authentication And Access

| Screen | Route or state | Requirements |
|---|---|---|
| `01-sign-in.png` | `/sign-in`, managed email/password fallback | R1 |
| `10-auth-access-unavailable.png` | Safe non-enumerating sign-in failure | R1 |
| `11-session-expired.png` | Protected-session interruption and resume | R1, NFR-2 |
| `15-resource-unavailable.png` | Non-disclosing unauthorized/not-found state | R1, R2, R8 |
| `40-mobile-sign-in.png` | Mobile sign-in fallback | R1, NFR-1 |

The sign-in images depict the managed email/password fallback. They are not a
second authentication mode. If HELP Connect reuse is selected, the application
entry should hand off to that provider while preserving the same post-login
authorization and session states.

## Educator Roster And Assessments

| Screen | Route or state | Requirements |
|---|---|---|
| `02-assigned-children.png` | `/children` populated | R2 |
| `12-assigned-children-empty.png` | No active child assignments | R2 |
| `13-children-load-error-v2.png` | Recoverable child-list failure | R2, NFR-2 |
| `14-child-detail-history-v2.png` | `/children/[childId]` | R2, R3 |
| `16-assessments-list.png` | Educator active/finalized assessment navigation | R2, R6 |
| `34-mobile-assigned-children.png` | Responsive child selection | R2, NFR-1 |

## Intake And Upload

| Screen | Route or state | Requirements |
|---|---|---|
| `03-upload-observation.png` | Upload in progress | R3 |
| `17-upload-ready.png` | Upload complete, ready to process | R3 |
| `18-upload-validation-error.png` | Type/duration/size validation failure | R3 |
| `19-upload-network-failure.png` | Recoverable interrupted upload | R3, NFR-2 |
| `20-permission-blocked.png` | Processing permission not approved | R3, R8 |
| `35-mobile-upload.png` | Responsive completed upload | R3, NFR-1 |

## Processing

| Screen | Route or state | Requirements |
|---|---|---|
| `04-processing.png` | Queued/running durable status | R4 |
| `21-processing-failed.png` | Safe failure and educator retry | R4 |
| `22-processing-ready.png` | Validated result ready for review | R4 |
| `36-mobile-processing.png` | Responsive running status | R4, NFR-1 |

## Review Workspace

| Screen | Route or state | Requirements |
|---|---|---|
| `05-review-workspace.png` | Complete desktop review workspace | R5 |
| `23-review-save-failure.png` | Visible unsaved input and retry | R5, NFR-2 |
| `24-review-video-unavailable.png` | Expired private video access recovery | R5, R8 |
| `25-review-conflict-v2.png` | Stale-save conflict without overwrite | R5, NFR-2 |
| `26-review-no-valid-results.png` | Invalid scoring result; no partial draft | R4, R5 |
| `37-mobile-review-list.png` | Mobile video and grouped item list | R5, NFR-1 |
| `38-mobile-review-editor.png` | Mobile decision editor | R5, NFR-1 |
| `42-tablet-review-workspace.png` | Tablet review workspace | R5, NFR-1 |
| `44-review-loading.png` | Stable loading projection and video state | R5, NFR-1 |

## Summary And Finalization

| Screen | Route or state | Requirements |
|---|---|---|
| `06-finish-review.png` | Complete pre-final summary | R6 |
| `27-summary-incomplete.png` | Remaining items block confirmation | R6 |
| `07-final-assessment.png` | Read-only finalized record | R6 |
| `39-mobile-summary.png` | Responsive complete summary | R6, NFR-1 |
| `41-mobile-final-assessment.png` | Responsive finalized record | R6, NFR-1 |
| `43-tablet-summary.png` | Tablet complete summary | R6, NFR-1 |

## Minimal Administration

| Screen | Route or state | Requirements |
|---|---|---|
| `08-admin-pilot-access.png` | `/admin/access`, provisioning and assignments | R7 |
| `28-admin-access-empty.png` | No provisioned staff | R7 |
| `29-admin-access-load-error.png` | Safe access-list load failure | R7 |
| `30-admin-deactivate-confirmation-v2.png` | Explicit access deactivation | R7, R8 |
| `31-admin-remove-assignment-v2.png` | Explicit child unassignment | R7, R8 |
| `09-admin-processing-jobs.png` | `/admin/jobs`, failed/stuck run details | R7 |
| `32-admin-jobs-empty-v2.png` | No failed or stuck jobs | R7 |
| `33-admin-retry-confirmation-v2.png` | Existing-video retry confirmation | R4, R7 |
| `45-admin-jobs-load-error.png` | Safe jobs-list load failure | R7 |

## Contact Sheets

- `00-overview-core.jpg`: primary desktop routes and educator journey.
- `00-overview-states.jpg`: review, authorization, and Admin recovery states.
- `00-overview-responsive.jpg`: mobile and tablet layouts.

## Prompt System

All accepted images were generated with the built-in ImageGen tool using the
`ui-mockup` use case. The shared prompt system specified:

- Production operational SaaS fidelity rather than marketing-page composition.
- Warm-white canvas, white surfaces, ink navy text, teal actions, semantic green,
  amber, coral, and gray-blue states, with no gradients.
- Compact typography, 6px corners, stable controls, visible focus/selection, and
  status meaning that does not rely on color alone.
- Synthetic child identifiers only, no child names in educator records, and no
  raw provider errors, private URLs, passwords, or scoring payloads.
- No dashboard, batch workflow, prompt management, reliability tooling, PDF,
  export center, rubric editor, or other explicitly excluded product surface.
- Lovable-inspired review hierarchy with real video evidence, grouped suggestions,
  a selected-item editor, durable save states, and human-controlled finalization.

Generated images are design references, not pixel-accurate implementation specs.
Labels controlled by unresolved content contracts, including the final negative
credit wording and add-on flags, must be updated after stakeholder confirmation.
