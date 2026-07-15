# HELP Review Deployment Evidence

Updated: July 14, 2026

## Current Sanitized GCP Environment

| Dependency | Current evidence | Boundary |
|---|---|---|
| Web | Public Cloud Run `help-review-web`; `https://help-review-web-2xa56y735q-uc.a.run.app` | Sanitized development, not real-data production |
| Database | Neon PostgreSQL via pooled runtime and direct migration URLs | Sanitized records only |
| Storage | Private GCS bucket with public-access prevention, uniform access, resumable upload, immutable generations, and lifecycle rules | Synthetic/sanitized videos only |
| Worker | IAM-private `help-review-processor` Cloud Run service invoked by Eventarc object-finalized delivery | Vertex synthetic development only |
| Scoring | Gemini 2.5 Flash on Vertex AI through processor ADC; canonical `gs://` input | Contract/transport evaluation, not scientist acceptance |
| Identity | Eight-hour HMAC-signed, HTTP-only sandbox sessions checked against active provision and assignment | No HELP Connect claim |
| Playback | Five-minute application grant followed by a generation-bound V4 GCS signed URL; metadata-only access record | Current assignment/session required |
| Delivery | Cloud Build images in Artifact Registry and Terraform-managed APIs/IAM/services/trigger | Local state pending organization backend handoff |

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

On July 14, 2026, `prisma migrate deploy` applied the GCP processing runtime migration after the earlier contract migration. `prisma migrate status` reports all four migrations current. The latest migration adds GCS object metadata and Eventarc delivery/idempotency fields.

Provider backup/restore and organization-approved rollback evidence remain external gates; applying this forward, additive migration does not satisfy them.

## Verification Evidence

| Gate | Result |
|---|---|
| TypeScript | pass |
| ESLint | pass |
| Vitest | 20 files, 119 tests pass |
| Prisma schema/migrations | schema valid; four migrations current on sanitized Neon |
| Behavioral browser contracts | 18 tests pass: 14 workflow contracts, 3 route/UI smoke checks, and 1 performance/payload budget |
| Accessibility/reflow | 6 representative keyboard/focus/zoom checks pass; every accepted screen receives serious/critical axe audit |
| Accepted visual states | screens 01-45 pass deterministic baselines |
| Stress visual states | long skill, dense results, long email, localized label pass |
| Visual total | 52 tests pass |
| Security/privacy | forged session, unsafe return, cross-origin mutation, role/assignment substitution, grant tampering, payload exclusion, and health redaction pass |

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

The latest repository candidate is deployed on Google Cloud with distinct session, playback, upload, and worker secrets plus explicit Vertex scoring, sandbox identity, and real-data-disabled configuration. No secret value is recorded here. The older Vercel alias remains historical evidence, not the selected forward architecture. This is a verified sanitized development deployment, not permissioned staging or real-data production.

Real-data production acceptance remains closed by `external-launch-gates.md`.
