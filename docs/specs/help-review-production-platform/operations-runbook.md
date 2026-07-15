# HELP Review Operations Runbook

Updated: July 14, 2026  
Applies to: local development, CI, and the sanitized Google Cloud/Neon deployment  
Real child data: disabled

## Runtime Matrix

| Environment | State | Video | Identity | Scoring | Data boundary |
|---|---|---|---|---|---|
| Local (`pnpm dev:stack`) | locked ignored `.data/` shared by two processes | ignored `.data/uploads/` | signed sandbox profiles | standalone HTTP processor + deterministic fake | synthetic/sanitized |
| CI | ephemeral PostgreSQL | local synthetic fixture | signed sandbox profiles | deterministic fake | synthetic/sanitized |
| GCP development | pooled Neon | private GCS | signed provisioned sandbox profiles | Eventarc + private Cloud Run processor + Vertex AI | synthetic/sanitized |
| Real-data production | approved PostgreSQL target | approved organization GCS policy | HELP Connect or one managed provider | accepted scientist gateway | closed by runtime guard |

The GCP development deployment sets `HELP_REVIEW_SANITIZED_PRODUCTION_ACK=true`, `HELP_REVIEW_REAL_DATA_ENABLED=false`, `HELP_REVIEW_STATE_ADAPTER=neon`, `HELP_REVIEW_VIDEO_ADAPTER=gcs`, `HELP_REVIEW_PROCESSING_ADAPTER=gcs-event`, and `HELP_REVIEW_SCORING_ADAPTER=vertex`. It requires `DATABASE_URL`, the private bucket/project/location values, and distinct 32-character-or-longer session, playback, upload, and worker secrets. Cloud Run receives secrets from Secret Manager. Fake/sandbox adapters remain forbidden when real-data mode is requested.

Never place secret values in source, browser variables, URLs, screenshots, support events, or incident tickets.

## Release Procedure

1. Confirm the worktree scope and preserve unrelated user changes.
2. Run `pnpm install --frozen-lockfile`, `pnpm db:generate`, and `pnpm build:processor`.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm db:validate`.
4. Apply migrations with `pnpm db:migrate`; require `pnpm db:status` to report the schema current.
5. Run `pnpm test:e2e`, `pnpm test:a11y`, and `pnpm test:visual`.
6. Run a production build with the acknowledged sanitized adapter variables.
7. Build immutable web and processor images with the Cloud Build files in `infra/gcp/`; never place `.env` in the build context.
8. Run a full Terraform plan with explicit image tags, review that it contains no unexpected destroy, then apply it.
9. Verify `/api/health`, Cloud Run readiness, Eventarc trigger state, sign-in, direct GCS upload completion, private processor delivery, Vertex outcome, authorized signed range playback, review persistence, finalization, Admin revocation, and retry.
10. Record the deployment URL, commit, migration state, checks, and any open gate in `deployment-evidence.md`.

The release is not a real-data launch. Do not change the top sandbox banner or `HELP_REVIEW_REAL_DATA_ENABLED` until every external gate is accepted.

## Database

- Runtime traffic uses pooled `DATABASE_URL`; Prisma migration commands use `DIRECT_URL`.
- Migrations are forward-only in the shared sanitized database. Never edit an applied migration.
- Before a destructive migration, create and verify an approved provider backup or branch. This provider-owned backup exercise has not yet been accepted for real-data production.
- If application code is incompatible after a non-destructive migration, redeploy the prior application version while preparing a forward-fix migration.
- If the migration itself is invalid, stop writes, preserve evidence, and use a reviewed forward recovery. Do not run `prisma migrate reset` against shared or production data.
- A schema drift or pending-migration result blocks deployment.

## Video And Playback

- Only synthetic or explicitly sanitized MP4, WebM, or MOV input is allowed.
- The sanitized limit is 100 MB and five minutes where duration is measurable.
- GCS enforces public-access prevention and uniform bucket-level access. The database stores opaque names, bucket, immutable generation, and verified metadata, never temporary upload or playback URLs.
- The browser uploads through an origin-bound resumable session. Completion checks server-owned metadata, generation, CRC32C, container signature, type, and size. Replacement/removal deletes the previous active object.
- Playback requires both a current signed user session and a five-minute purpose-specific grant, then redirects to a V4 signed GCS read URL. Range requests are served by Cloud Storage.
- An incomplete or unverified object is never processing-eligible.
- Development marker objects expire after one day and synthetic videos after 30 days. These are development cleanup values, not the approved real-video retention policy.
- Provider retention, backup, deletion deadline, and incident ownership remain real-data launch gates.

## Processing Worker

- Browser actions create a persisted `QUEUED` run and an idempotent `processing-requests/{runId}.json` marker. Eventarc delivers finalization to `POST /events/storage` on the IAM-private processor service.
- The processor claims one attempt transactionally, reads the immutable GCS media reference, calls Vertex AI through ADC, validates the complete result, and atomically commits suggestions.
- A queued/running attempt older than 15 minutes is marked `PROCESSING_STUCK`.
- A five-minute run lease makes duplicate Eventarc delivery return retry without starting concurrent scoring. Retryable delivery errors are requeued up to the configured application delivery limit; terminal runs remain visible to Educator/Admin follow-up.
- Safe retry creates one linked attempt and a new marker. Previous failures remain visible; existing review decisions block result replacement.
- Cloud Tasks, Redis, and Gemini Files are intentionally absent. The canonical video remains in GCS.
- Local development uses `HELP_REVIEW_PROCESSING_ADAPTER=http` and dispatches to `http://127.0.0.1:8081`; `HELP_REVIEW_WORKER_SECRET` authenticates that internal route when configured.
- Never expose a provider payload or exception. Use the correlation/reference and the safe category in Admin support.

## Health And Observability

- `GET /api/health` returns only `status` and `checkedAt`; `503` includes `Retry-After`.
- Route failures emit JSON with `event`, an opaque correlation ID, and error type only.
- Processing outcomes emit structured run outcome, duration, safe category, and retryability without child identifiers, video paths, provider payloads, or secrets.
- Support records retain actor, time, purpose/reference, and the affected assessment/subject where allowed.
- Alert candidates for the sanitized environment: readiness unavailable for five minutes, Eventarc delivery failures, repeated processor authentication failures, a growing stuck count, or repeated storage/Vertex failures. Named on-call and incident owners remain an organization gate.

## Access Support

1. Confirm the caller is an authorized pilot Admin.
2. Use `/admin/access` for exact provision, activation/deactivation, and one assignment change.
3. Use `/admin/jobs` for safe failed/stuck history and eligible retry only.
4. Do not open child records, videos, review projections, raw scoring output, or database rows on an Admin's behalf.
5. Deactivation and unassignment apply on the next request; validate with a fresh direct request rather than relying on hidden navigation.

## Secret Rotation

1. Add a new Secret Manager version without recording the value in source, a plan file, or a shell transcript.
2. Deploy new Cloud Run revisions so `latest` resolves the new version, then verify readiness plus the affected flow.
3. Session-secret rotation intentionally expires current sessions. Playback-secret rotation invalidates outstanding five-minute grants.
4. Rotate worker/cron secrets together with the configured scheduler authorization.
5. Remove the prior value only after the new deployment and smoke check pass.
6. Record who rotated it, when, the affected environment, and the smoke reference, never the value.

## Incident Procedure

1. Keep or force `HELP_REVIEW_REAL_DATA_ENABLED=false`.
2. Stop the affected operation: revoke access, disable the schedule, or disable the selected scoring adapter as appropriate.
3. Preserve correlation IDs, safe run IDs, deploy ID, timestamps, and provider incident references. Do not copy protected payloads.
4. Determine whether state, storage, identity, scoring, or network was authoritative at failure time.
5. Reconcile before retrying so no duplicate run, object, decision, or final record is created.
6. Recover forward, run the focused contract and smoke checks, then restore traffic.
7. Escalate privacy/security events to the named organization owner once that owner is recorded.

## Rollback And Recovery Limits

Application rollback is valid only when the current schema remains backward compatible: point Terraform at the prior immutable Artifact Registry tags, review the no-destroy plan, and apply. Database restore, object restore, organization alerting, cost ownership, and real-data incident exercises require the accepted organization accounts and remain explicit gates in `external-launch-gates.md`.
