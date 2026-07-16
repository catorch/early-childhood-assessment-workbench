# HELP Review Deployment Evidence

Updated: July 15, 2026

## Current Sanitized GCP Environment

| Dependency | Current evidence | Boundary |
|---|---|---|
| Web | Public Cloud Run `help-review-web`; `https://help-review-web-2xa56y735q-uc.a.run.app` | Sanitized development, not real-data production |
| Database | Neon PostgreSQL via pooled runtime and direct migration URLs | Sanitized records only |
| Storage | Private GCS bucket with public-access prevention, uniform access, resumable upload, immutable generations, and lifecycle rules | Synthetic/sanitized videos only |
| Worker | IAM-private `help-review-processor` Cloud Run service invoked by Eventarc object-finalized delivery | Vertex synthetic development only |
| Scoring | Gemini 2.5 Flash on Vertex AI through processor ADC; canonical `gs://` input | Contract/transport evaluation, not scientist acceptance |
| Identity | Google Identity Platform email/password with exact local provisioning, verified provider subjects, one-hour application sessions, and mirrored activation/deactivation | Managed synthetic staging accounts; no public signup or HELP Connect claim |
| Playback | Five-minute application grant followed by a generation-bound V4 GCS signed URL; metadata-only access record | Current assignment/session required |
| Delivery | Cloud Build images in Artifact Registry and Terraform-managed APIs/IAM/services/trigger | Local Terraform state pending organization backend handoff |

## July 15 Managed-Identity QA2 Candidate

| Field | Evidence |
|---|---|
| Project / region | `help-review-dev-20260714` / `us-central1` |
| Cloud Build | `7e8bd1d7-a3e0-40ab-94fc-e91a39e1a442`, `SUCCESS` |
| Web image | `help-review/web:20260715-qa2` at digest `sha256:8829fdec8e3938e535ed45e85f1c5cde2f975cc971523f52cc7c7e6c95380135` |
| Processor image | QA1 processor digest retained at `sha256:a3d5a93401d0b422513aa5e4859ba842f27d18b9e14fdadf136f644e16721cfd` |
| Ready revisions | Web `help-review-web-secret-20260715` after the rotation drill; processor `help-review-processor-00008-x8x` |
| Runtime boundary | Real data off, Google Identity Platform enabled, Neon/GCS/Eventarc/Vertex selected, provisional catalogue version and exact SHA configured |
| Terraform result | Managed identity, provider lifecycle IAM, quota dependencies, GCS Eventarc publishing, and observability converge to a final `No changes` plan |

The QA2 exercise used ordinary browser controls and the deployed provider rather than mocked credentials:

- The current Google account was first provisioned as an exact Admin through the existing Admin API, then linked to its stable Identity Platform UID on verified sign-in. Wrong credentials produced only the generic focused error and cleared the password; sign-out removed the application cookie and made `/api/session` return `401`.
- The password-reset button called Google successfully and kept the response non-enumerating. A second provisioned Educator account proved the full setup boundary: an unverified provider token was rejected by HELP Review with `401`, the verification-message request returned `200`, the provider verification action code returned `200`, and the next provider record reported `emailVerified=true`.
- The provider reset action code accepted a new password and a subsequent provider sign-in returned `200`. No password, refresh token, action code, API key, or ID token was recorded in source, logs, screenshots, or this evidence.
- Admin deactivation returned `200`, immediately made the provider account disabled, and caused provider sign-in to return `400`. Admin reactivation returned `200`, re-enabled the same UID, and the Educator reached the assignment-scoped `/children` page.
- Twelve malformed application-session attempts under one opaque synthetic cookie produced ten generic `401` responses followed by two shared PostgreSQL-backed `429` responses, proving the deployed abuse budget is shared rather than instance-local.
- The live exercise found that `roles/firebaseauth.viewer` could verify users but could not perform the approved Admin account lifecycle. Google's predefined Admin/Editor roles also include configuration secrets and user deletion, so Terraform now creates a project role containing only `firebaseauth.users.get/create/update`. A new account was provisioned and then disabled, re-enabled, and disabled for cleanup through the application after that narrower role was applied.
- Terraform also now sends user-credential quota to the selected billing project, explicitly enables Cloud Resource Manager, and derives the GCS service-agent address from the stable project number. This fixed an Identity Toolkit quota failure and removed an apply-time IAM replacement. The temporarily removed GCS publisher member was restored and verified before testing resumed.
- The first managed page paint incorrectly described a sandbox profile while configuration was loading. QA2 uses neutral loading copy, its regression test delays the configuration response, and desktop/mobile visual inspection found no clipping, overlap, or horizontal overflow.

Release recovery was then exercised on the same managed deployment. Terraform rolled QA2 back to immutable QA1 revision `help-review-web-00010-gcc` in 44 seconds with a no-destroy plan, health passed, and the existing managed session remained valid. Terraform rolled forward to QA2 revision `help-review-web-00011-jwm` in 44 seconds with the same result. Secret Manager session-secret version 2 was added without exposing its value; `gcloud` created `help-review-web-secret-20260715` in 14 seconds, the old application cookie returned `401`, and a fresh Google sign-in returned `200`. Terraform ignores only Cloud Run's operational client/version/revision labels, continues to manage every behavioral setting, and again reports no changes.

## July 15 Sanitized QA1 Candidate

| Field | Evidence |
|---|---|
| Project / region | `help-review-dev-20260714` / `us-central1` |
| Cloud Build | `3e2638c3-4665-4d27-96f4-2d2ba7122cda`, `SUCCESS` in 3m36s |
| Web image | `help-review/web:20260715-qa1` at digest `sha256:2bae47125d5094e48e5f431656210450b6818dc26630a0503b0aa68eab28625a` |
| Processor image | `help-review/processor:20260715-qa1` at digest `sha256:a3d5a93401d0b422513aa5e4859ba842f27d18b9e14fdadf136f644e16721cfd` |
| Cloud Run revisions | Web `help-review-web-00007-rjh`; processor `help-review-processor-00007-g7g`; both Ready |
| Runtime boundary | Real data off, sandbox identity retained, Neon/GCS/Eventarc/Vertex selected, provisional catalogue version and exact SHA configured |
| Observability | Two log metrics, two enabled alert policies, one email channel, and the operations dashboard are deployed |
| Terraform result | Initial no-destroy rollout completed; the fresh-metric propagation defect was remediated; final refresh reports `No changes` |

The QA1 smoke exercised the deployed candidate rather than a local server:

- Public health returned `ready`; sandbox sign-in returned the expected Educator projection and three assignment-scoped sanitized children.
- A live browser confirmed the configured support action had a real recipient and the fixed Provision staff keyboard lifecycle moved focus into the form and back to its trigger.
- Assessment creation persisted `contentCatalogVersion=help-2-provisional-2026-07`, proving the packaged catalogue passed startup and runtime validation.
- The 64,256-byte synthetic MP4 uploaded through the ordinary generation-bound resumable GCS flow and completion returned only the public video projection.
- Start processing returned one queued run. Eventarc invoked processor revision `00007-g7g` after the web request completed; the run moved to `RUNNING` and then failed closed as `INVALID_RESULT` when the provisional Vertex result did not validate. No partial suggestions were exposed.
- The deployed structured outcome contained only event, opaque run ID, adapter, outcome, duration, and retryability fields. A separate payload-free monitoring drill produced a metric value of one for `help_review_processing_failures` on revision `00007-g7g`; both warning/error policies are enabled.
- The first observability bootstrap exposed Google Monitoring's asynchronous log-metric propagation: the metrics were created while policy creation returned `404`. Terraform now creates a one-time 90-second propagation guard before either policy and ignores only server-injected dashboard JSON fields. A second apply completed the policies, and a final plan was clean with zero changes or destroys.

At the QA1 checkpoint, the development alert channel was enabled but receipt and ownership of the final organization operations address were not yet accepted. Managed Identity Platform was build-tested but intentionally left off until a bootstrap Admin existed. QA2 above provisioned that Admin, enabled the provider, and supersedes the QA1 identity state; final organization alert receipt remains open.

## July 14 Google Cloud Release

| Field | Evidence |
|---|---|
| Project / region | `help-review-dev-20260714` / `us-central1` |
| Web image | `help-review/web:20260714-gcp8` |
| Processor image | `help-review/processor:20260714-gcp7` |
| Cloud Run revisions | Web `help-review-web-00006-qtd`; processor `help-review-processor-00006-zzx`; both Ready |
| Eventarc | `help-review-processing-requests` targets `/events/storage` on the private processor |
| Storage | `help-review-dev-20260714-help-review-videos`; public access prevention and uniform bucket access enabled |
| Secrets | Database, session, playback, upload, and worker values injected from Secret Manager; no values recorded |
| Runtime scoring | Restored to `vertex` after a bounded fake-scoring playback smoke |

The live GCP smoke used the 64,256-byte synthetic MP4 through ordinary browser controls:

- Public health and sign-in returned `200`; the processor reported Ready and unauthenticated public health access resolved only to a generic `404` because ingress/IAM is private.
- The browser created an assessment and uploaded directly to GCS. A first smoke exposed Cloud Run's internal origin leaking into the resumable session; the validated browser-facing origin fix is retained in the final `gcp8` web image and the completion command passes.
- Completion persisted the opaque GCS name, bucket, immutable generation, CRC32C, and verified metadata without returning a storage key or upload URL to ordinary projections.
- Start processing persisted a run and marker. Eventarc invoked the processor after the initiating page closed. Vertex read the canonical GCS object and returned `NO_VALID_RESULTS`; the application stored the safe all-or-nothing no-partial-result state.
- Re-finalizing the same run marker returned `204` without creating another attempt or suggestion set.
- A controlled fake-scoring smoke produced four suggestions to exercise the downstream media path. The source video loaded as 320x180, a signed `bytes=0-31` request returned `206` with exactly 32 bytes, and selecting evidence `0:03` moved the player to 3 seconds.
- Desktop 1440x1000 and mobile 390x844 review states were visually inspected. The mobile document width equaled the viewport; no overlapping controls, horizontal overflow, clipped video, or illegible labels were observed.
- The deployment was returned to Vertex immediately after the playback smoke.
- The final `gcp8`/`gcp7` state was reached through in-place Cloud Run image updates, with zero creates or destroys. A post-rollout Eventarc marker reached processor revision `00006-zzx` at `/events/storage` and returned `204`; a subsequent Terraform plan reported no changes.
- `pnpm dev:stack` independently started Next.js on 3000 and the processor on 8081. A local Start command returned `202`, the processor logged a completed fake run, and the UI reached eight validated suggestions.

## Historical Vercel Release

### July 14 Sanitized Vercel Release

| Field | Evidence |
|---|---|
| Deployment ID | `dpl_Bh3XzZLV2PiKNdpQYs67mBQZ5hvv` |
| Immutable deployment | `https://earlychildhoodassessment-pc58d3mqt-catorchs-projects-1a2d7c42.vercel.app` |
| Production alias | `https://earlychildhoodassessment.vercel.app` |
| Vercel state | `READY`, production target |
| Build region | Washington, D.C., USA (`iad1`) |
| Source upload | 144.1 KB after `.vercelignore` excluded local builds, dependencies, test artifacts, data, and documentation |
| Build | Dependency install, Prisma generation, Next.js compile, TypeScript, 18 static page generations, and output deployment passed |

## Migration Evidence

On July 14, 2026, `prisma migrate deploy` applied the GCP processing runtime migration after the earlier contract migration. That fourth migration added GCS object metadata and Eventarc delivery/idempotency fields.

On July 15, 2026, the additive roster-import audit and shared-rate-limit migrations were applied and `prisma migrate status` reported all six migrations current against the configured Neon direct endpoint.

All six checked-in migrations were also applied to a fresh isolated PostgreSQL 18 database. They completed successfully and the temporary database container was removed.

On July 15, `pnpm db:recovery-drill -- --confirm-temporary-schema` first exercised a real logical recovery on the configured Neon endpoint at the five-migration revision. It created an isolated schema, inserted one synthetic marker, produced a 52,120-byte custom-format backup, restored and verified the schema, and cleaned every artifact in 33.4 seconds. After the sixth migration, the same guarded drill passed against isolated PostgreSQL 18 with all six migrations, the marker, and a 53,842-byte archive in 1.636 seconds. The shared-rate-limit drill also serialized 12 concurrent increments from 1 through 12 and removed its opaque bucket. No drill printed a database URL or touched shared application tables. QA2 subsequently proved immutable-image rollback/roll-forward, session-secret rotation, session revocation, and recovery sign-in. Provider point-in-time recovery and final organization notification receipt remain separate launch evidence.

## Verification Evidence

| Gate | Result |
|---|---|
| TypeScript | pass |
| ESLint | pass |
| Vitest | 27 files, 165 tests pass |
| HELP catalogue | versioned fixture validates; exact version/status/hash and real-data rejection tests pass |
| Prisma schema/migrations | schema valid; six migrations current on sanitized Neon; clean-schema deploy, shared-counter concurrency, and isolated logical backup/restore pass |
| Behavioral browser contracts | 46 tests pass, including managed identity, canonical user-story behaviors, workflow, route/UI, security, and performance contracts |
| Accessibility/reflow | 6 representative keyboard/focus/zoom checks and every accepted screen's serious/critical axe audit pass; the full local Educator/Admin keyboard record closed two focus-loss defects, while supported-screen-reader acceptance remains open |
| Accepted visual states | screens 01-45 pass deterministic baselines |
| Stress visual states | long skill, dense results, long email, localized label pass |
| Visual total | 52 tests pass |
| Security/privacy | forged session, unsafe return, cross-origin mutation, role/assignment substitution, grant tampering, payload exclusion, and health redaction pass |
| Production build | Next.js production compile, TypeScript, page-data collection, and all route generation pass with fail-closed sanitized GCP configuration |
| Local service boundary | web and standalone processor health pass; synthetic upload/process reaches `READY_FOR_REVIEW` with eight suggestions over internal HTTP |
| Canonical story tracker | 137 pass, 8 partial pass, and 1 incomplete exact-build release story in `docs/quality/help-review-feature-status.csv` |

## Historical Vercel Smoke Evidence

The July 14 release was exercised with a new synthetic 64,256-byte MP4 through ordinary browser controls:

- `/api/health` returned `200` and `ready` with CSP, HSTS, frame, referrer, permissions, cross-origin, no-sniff, and no-store headers.
- Sandbox sign-in issued an HTTP-only, secure, same-site cookie and returned three assignment-scoped children.
- The browser created a new assessment, uploaded the synthetic video directly to private Blob, and received only the public video projection.
- Processing was started and the initiating page was closed. Persisted status reached `READY_FOR_REVIEW` with one completed attempt and eight validated suggestions.
- Vercel runtime logs then showed the authenticated scheduled `/api/internal/processing` recovery route returning `200` on successive one-minute invocations.
- A purpose-bound playback URL returned `206` for `bytes=0-31` with the correct bounded content range.
- A review decision and note saved, the selected skill remained in the allowlisted URL state, and both selection and note restored after reload.
- All eight items reconciled on the complete summary; browser confirmation created the final record. No edit controls remained and a direct post-finalization decision command returned `409`.
- After normal sign-out/Admin sign-in, direct review access returned the generic `404`; the job projection contained neither storage keys nor scoring-configuration/provider fields.
- Desktop Admin and 360x800 assigned-child views were inspected after settling. Both had coherent layout and no horizontal overflow, clipping, or overlapping controls.

## Release Candidate State

The latest repository candidate is deployed on Google Cloud with distinct session, playback, upload, and worker secrets plus explicit Vertex scoring, managed Google Identity Platform, and real-data-disabled configuration. No secret value is recorded here. The older Vercel alias remains historical evidence, not the selected forward architecture. This is a verified sanitized development deployment, not the final organization-owned permissioned staging or real-data production environment.

Real-data production remains disabled until the concrete closure inputs and exact-build evidence in `external-launch-gates.md` are complete; permissions are treated as approved.
