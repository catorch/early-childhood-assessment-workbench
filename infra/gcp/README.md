# Google Cloud Deployment

This directory provisions the sanitized HELP Review topology:

- public `help-review-web` Cloud Run service;
- IAM-private `help-review-processor` Cloud Run service;
- private, public-access-prevented GCS bucket;
- Eventarc object-finalized delivery for `processing-requests/` markers;
- Vertex AI access for the processor;
- Secret Manager containers and least-privilege runtime access;
- Artifact Registry plus Cloud Build definitions.

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
terraform -chdir=infra/gcp init
terraform -chdir=infra/gcp plan -out=base.tfplan \
  -var=project_id=<project-id>
terraform -chdir=infra/gcp apply base.tfplan
```

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

## Build And Deploy

Use immutable tags. The combined build creates both containers; the web-only
and processor-only files support focused fixes.

```bash
gcloud builds submit --region=us-central1 \
  --config=infra/gcp/cloudbuild.yaml \
  --substitutions=_TAG=<immutable-tag> .

terraform -chdir=infra/gcp plan -out=services.tfplan \
  -var=project_id=<project-id> \
  -var=deploy_services=true \
  -var=web_image=us-central1-docker.pkg.dev/<project-id>/help-review/web:<immutable-tag> \
  -var=processor_image=us-central1-docker.pkg.dev/<project-id>/help-review/processor:<immutable-tag>
terraform -chdir=infra/gcp apply services.tfplan
```

Review every plan. A routine image rollout should be an in-place Cloud Run
change with no destroys.

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

## State And Handoff

The checked-in configuration ignores local Terraform state. Before an
organization-operated environment, create a separately administered GCS state
bucket with versioning, restricted IAM, and the accepted retention policy;
copy `backend.tf.example` to the operator-owned configuration and run
`terraform init -migrate-state`. Do not migrate the development state without
the receiving owner present.

Real child data remains disabled until identity, permission, retention,
deletion, backup/restore, incident, technical, and budget ownership decisions
are accepted.
