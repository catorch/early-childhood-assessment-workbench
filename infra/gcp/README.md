# Google Cloud Deployment

This directory provisions the sanitized HELP Review topology:

- public `help-review-web` Cloud Run service;
- IAM-private `help-review-processor` Cloud Run service;
- private, public-access-prevented GCS bucket;
- Eventarc object-finalized delivery for `processing-requests/` markers;
- Vertex AI access for the processor;
- Secret Manager containers and least-privilege runtime access;
- Artifact Registry plus Cloud Build definitions;
- redacted route/processing log metrics, email alert policies, and an operations dashboard.
- optional Google Cloud Identity Platform email/password with disabled public signup, a referrer/API-restricted browser key, and application-authorized provider user lifecycle access.

Neon remains the PostgreSQL provider and is injected as `DATABASE_URL`. The
browser uploads the video directly to GCS. Vertex reads that same `gs://`
object, so there is no Cloud Tasks queue, Redis dependency, or Gemini Files
copy.

## Local Equivalent

Google Cloud is not required for ordinary development:

```bash
pnpm install
pnpm dev:stack
```

The web app runs at `http://127.0.0.1:3000` and dispatches to the standalone
processor at `http://127.0.0.1:8081`. Local state uses a cross-process file
lock; local video and deterministic fake scoring keep the loop self-contained.

## Bootstrap

Use a billing-enabled project that is approved for synthetic development.
Authenticate `gcloud`, set the project, then initialize Terraform:

```bash
gcloud config set project <project-id>
gcloud auth application-default set-quota-project <project-id>
terraform -chdir=infra/gcp init
terraform -chdir=infra/gcp plan -out=base.tfplan \
  -var=project_id=<project-id> \
  -var=support_email=<organization-owned-support-address> \
  -var=alert_email=<organization-owned-on-call-address>
terraform -chdir=infra/gcp apply base.tfplan
```

The provider explicitly sends quota/billing attribution to `project_id` and
manages Cloud Resource Manager as a prerequisite. This keeps local authorized
user credentials and CI service-account credentials on the same API boundary.

The base apply enables APIs and creates the bucket, repository, service
accounts, IAM, and empty secret containers. Add secret versions out of band;
never place secret values in Terraform variables or state:

```bash
gcloud secrets versions add help-review-database-url --data-file=-
gcloud secrets versions add help-review-session-secret --data-file=-
gcloud secrets versions add help-review-playback-secret --data-file=-
gcloud secrets versions add help-review-upload-secret --data-file=-
gcloud secrets versions add help-review-worker-secret --data-file=-
```

Apply Prisma migrations through the direct Neon connection before deploying
an image that requires the new schema:

```bash
pnpm db:migrate
pnpm db:status
```

Validate the exact catalogue included in the build context. For real-data
images, replace the sanitized path/version with the owner-issued authoritative
artifact; startup rejects a status or version mismatch:

```bash
HELP_REVIEW_HELP_CATALOG_VERSION=<immutable-version> \
  pnpm catalog:validate content/<authoritative-catalog>.json
```

## Build And Deploy

Use immutable tags. The combined build creates both containers; the web-only
and processor-only files support focused fixes.

```bash
gcloud builds submit --region=us-central1 \
  --config=infra/gcp/cloudbuild.yaml \
  --substitutions=_TAG=<immutable-tag> .

terraform -chdir=infra/gcp plan -out=services.tfplan \
  -var=project_id=<project-id> \
  -var=support_email=<organization-owned-support-address> \
  -var=alert_email=<organization-owned-on-call-address> \
  -var=deploy_services=true \
  -var=web_image=us-central1-docker.pkg.dev/<project-id>/help-review/web:<immutable-tag> \
  -var=processor_image=us-central1-docker.pkg.dev/<project-id>/help-review/processor:<immutable-tag>
terraform -chdir=infra/gcp apply services.tfplan
```

Review every plan. A routine image rollout should be an in-place Cloud Run
change with no destroys.

For managed staging, select the one approved identity path and provide bare
authorized domains plus exact HTTPS referrer patterns:

```bash
terraform -chdir=infra/gcp plan -out=managed-services.tfplan \
  -var=project_id=<project-id> \
  -var=support_email=<organization-owned-support-address> \
  -var=alert_email=<organization-owned-on-call-address> \
  -var=identity_adapter=identity-platform \
  -var='identity_authorized_domains=["review.example.org"]' \
  -var='identity_allowed_referrers=["https://review.example.org/*"]' \
  -var=deploy_services=true \
  -var=web_image=<immutable-web-image> \
  -var=processor_image=<immutable-processor-image>
```

Terraform disables anonymous, phone, public-signup, and end-user-deletion
paths. In managed mode, Admin provisioning idempotently creates a provider
account without setting a password. Staff use the provider reset and email
verification messages before the first exact-email link. See
`docs/specs/help-review-production-platform/identity-platform-contract.md`.
The web service account receives a project custom role with only
`firebaseauth.users.get`, `firebaseauth.users.create`, and
`firebaseauth.users.update`. Those permissions cover token revocation checks
and the application-authorized create/disable/re-enable commands without
granting provider configuration, secret-reading, or user-deletion access.

The first observability apply sends a Google Cloud verification message to the
alert address. Verify the notification channel before treating alerts as live.
The initial route threshold is five redacted failures in five minutes; tune it
only from recorded staging behavior. A terminal processing outcome alerts on
the first occurrence. The initial apply deliberately waits 90 seconds after
creating log metrics before it creates alert policies because Google Monitoring
propagates new user-defined metric descriptors asynchronously. Monitoring adds
read-only fields to dashboard JSON, so later layout changes must be rolled out
explicitly with `terraform apply -replace=google_monitoring_dashboard.operations`.
Cloud Run also records the client/version and an operator-selected revision
name during `gcloud` recovery operations. Terraform ignores only those three
operational metadata fields so a secret-rotation revision does not create
false drift; images, environment, secrets, scaling, ingress, IAM, and traffic
remain managed.

## Smoke Checks

1. `GET <web-url>/api/health` returns `200` and `ready`.
2. Both Cloud Run services report `Ready=True`.
3. The Eventarc trigger targets processor path `/events/storage`.
4. A synthetic browser upload completes and the database stores a GCS object
   generation and CRC32C, not an upload URL.
5. Start processing creates one marker and Eventarc returns `204` or a bounded
   retry response from the private processor.
6. Cloud Logging records a redacted processing outcome.
7. An authorized playback grant redirects to a five-minute signed GCS URL and
   supports a bounded range read.
8. Direct unauthenticated processor invocation remains denied.
9. The operations notification channel is verified and a test incident reaches
   the named address without protected fields.
10. A provisioned managed test account completes reset, email verification,
    sign-in, logout, deactivation, and reactivation without a public signup path.

## State And Handoff

The checked-in configuration ignores local Terraform state. Before an
organization-operated environment, create a separately administered GCS state
bucket with versioning, restricted IAM, and the accepted retention policy;
copy `backend.tf.example` to the operator-owned configuration and run
`terraform init -migrate-state`. Do not migrate the development state without
the receiving owner present.

Real child data remains disabled until the approved identity, retention,
deletion, backup/restore, incident, and ownership configuration is applied and
the exact deployed build passes its acceptance record.
