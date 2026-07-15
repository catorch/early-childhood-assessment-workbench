# HELP Review Pilot

HELP Review is an Educator-first pilot for selecting an assigned child, uploading one private observation video, reviewing server-validated scoring suggestions, and confirming an immutable HELP assessment record. A deliberately small Admin surface manages provisioned access, assignments, and failed or stuck processing runs.

The implementation follows:

1. `docs/meeting-transcripts/July-10-meeting-transcript.md`
2. `docs/meeting-transcripts/july-14-meeting-transcript.md`
3. `docs/specs/help-review-production-platform/requirements.md`
4. `docs/specs/help-review-production-platform/design.md`
5. `docs/specs/help-review-production-platform/tasks.md`

Generated mockups are route-state and responsive references, not data or behavior contracts. Rejected explorations are excluded from the application and test harness.

## Implemented Platform

- HMAC-signed, HTTP-only sandbox sessions with role, deactivation, expiry, and safe return-target enforcement
- Assignment-scoped child, history, assessment, and authoritative next-action navigation
- Idempotent assessment creation and one-video intake with type, size, container, duration, and integrity checks
- Private local or Google Cloud Storage, direct resumable upload, opaque object paths, purpose-bound signed playback, and byte ranges
- Persisted processing attempts, idempotent GCS markers, Eventarc delivery, a private Cloud Run processor, safe retry rules, and atomic all-or-nothing results
- Versioned scoring schemas with deterministic fake scenarios and Gemini on Vertex AI reading the canonical `gs://` video
- Full desktop, tablet, and mobile review including evidence seeking, all four decision origins, notes, dismissal, failed saves, revision conflicts, and secure media restoration
- Server-derived incomplete/complete summaries, idempotent finalization, and read-only final records
- Admin provisioning/activation, assignments, safe failed/stuck job details, and replay-safe retry
- Public response projections, redacted errors/support records, security headers, origin/body/rate limits, and fail-closed conditional features
- Deterministic acceptance coverage for all 45 approved screen states plus long-content stress cases

The legacy Assessment Reliability Workbench, dashboards, batch/model/prompt tools, public signup, manual skill creation, add-on flags, PDF/export, alternate outputs, amendments, and parallel identity modes are not reachable.

## Data Boundary

Local development uses ignored `.data/` state/uploads and a standalone local processor. The shared Google Cloud development deployment uses normalized Prisma state on Neon, a private GCS bucket, Eventarc, a private Cloud Run processor, and Vertex AI. Both are restricted to deterministic or explicitly sanitized data.

Real child data remains disabled. HELP Connect or one managed identity provider, the scientist-owned scoring package/service, authoritative HELP content, roster and permission sources, video/privacy policy, organization-owned infrastructure, and recovery/incident ownership still require external acceptance. The exact gates are in `docs/specs/help-review-production-platform/external-launch-gates.md`.

Production-mode startup fails closed unless durable adapters, private storage, strong secrets, and an explicit sanitized acknowledgement are configured. `HELP_REVIEW_REAL_DATA_ENABLED=true` cannot run with sandbox identity or the unaccepted development scoring contract.

## Local Development

```bash
pnpm install
pnpm dev:stack
```

Open `http://localhost:3000/sign-in`; processor health is `http://127.0.0.1:8081/healthz`. `dev:stack` runs Next.js and the processor as separate processes, dispatching over the same internal HTTP contract used by tests. Choose a provisioned Educator or Admin sandbox profile. There is intentionally no public signup or dashboard. The local video policy accepts MP4, WebM, or MOV files up to 100 MB and five minutes when duration is available.

Useful adapter defaults:

```bash
HELP_REVIEW_STATE_ADAPTER=local
HELP_REVIEW_VIDEO_ADAPTER=local
HELP_REVIEW_PROCESSING_ADAPTER=http
HELP_REVIEW_PROCESSOR_URL=http://127.0.0.1:8081
HELP_REVIEW_SCORING_ADAPTER=fake
HELP_REVIEW_IDENTITY_ADAPTER=sandbox
```

Use `HELP_REVIEW_FAKE_SCORING_SCENARIO` to exercise `accepted`, `uncertain`, `no-valid-results`, `invalid-credit`, `invalid-evidence`, `empty-result`, `slow`, `retryable-failure`, or `terminal-failure`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:validate
pnpm db:status
pnpm test:e2e
pnpm test:a11y
pnpm test:visual
pnpm build
```

The July 14 engineering acceptance record is `docs/specs/help-review-production-platform/acceptance-evidence.md`. It records 112 unit/service checks, 18 behavioral browser checks, 6 accessibility/reflow checks, and 52 visual checks covering screens 01-45, 4 stress states, and 3 smoke baselines.

## Sanitized Google Cloud Deployment

The reference topology is a public web Cloud Run service, an IAM-private processor Cloud Run service, private GCS, Eventarc, Vertex AI, Secret Manager, Artifact Registry/Cloud Build, and Neon. Terraform is in `infra/gcp/`. Use the pooled Neon URL for runtime traffic and the direct URL for Prisma migrations. Never commit or print either value.

Required production variables for the sanitized candidate:

```text
DATABASE_URL
HELP_REVIEW_STATE_ADAPTER=neon
HELP_REVIEW_VIDEO_ADAPTER=gcs
HELP_REVIEW_PROCESSING_ADAPTER=gcs-event
HELP_REVIEW_SEED_SANITIZED_DATA=true
HELP_REVIEW_SCORING_ADAPTER=vertex
HELP_REVIEW_IDENTITY_ADAPTER=sandbox
HELP_REVIEW_SANITIZED_PRODUCTION_ACK=true
HELP_REVIEW_REAL_DATA_ENABLED=false
GCS_VIDEO_BUCKET=<private-bucket>
GOOGLE_CLOUD_PROJECT=<project-id>
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.5-flash
HELP_REVIEW_SESSION_SECRET=<distinct 32+ character secret>
HELP_REVIEW_PLAYBACK_GRANT_SECRET=<distinct 32+ character secret>
HELP_REVIEW_UPLOAD_GRANT_SECRET=<distinct upload secret>
HELP_REVIEW_WORKER_SECRET=<distinct worker secret>
```

Cloud Run receives runtime secrets from Secret Manager. Uploads go directly to GCS, completion is verified server-side, and browsers receive neither storage keys nor unrestricted provider output. Vertex reads the same GCS object; Cloud Tasks, Redis, and Gemini Files are not part of this topology.

```bash
pnpm db:migrate
pnpm db:status
gcloud builds submit --config=infra/gcp/cloudbuild.yaml --substitutions=_TAG=<immutable-tag> .
terraform -chdir=infra/gcp plan -var=project_id=<project-id> -var=deploy_services=true \
  -var=web_image=<web-image> -var=processor_image=<processor-image>
terraform -chdir=infra/gcp apply <reviewed-plan-file>
```

After deployment, follow `docs/specs/help-review-production-platform/operations-runbook.md` and record the URL, migration state, smoke checks, and open gates in `deployment-evidence.md`. The current sanitized service is `https://help-review-web-2xa56y735q-uc.a.run.app`.
