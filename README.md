# HELP Review Pilot

This repository is being rebuilt around the educator workflow confirmed in the July 10 meeting and later stakeholder follow-ups. The active product scope is an access-provisioned pilot where an educator selects an assigned child, uploads one observation video, reviews scientist-service suggestions, and confirms a final HELP summary.

The source of truth is:

1. `docs/meeting-transcripts/July-10-meeting-transcript.md`
2. `docs/specs/help-review-production-platform/requirements.md`
3. `docs/specs/help-review-production-platform/design.md`
4. `docs/specs/help-review-production-platform/tasks.md`

The Lovable review is a visual and interaction reference only. Its simulated video, preset summary values, and unwired controls are not production behavior.

## Current State

The legacy Assessment Reliability Workbench has been removed from the runtime. The repository now implements the complete educator journey and minimum Admin workflow against sanitized local adapters:

- Test-only Educator and Admin identity profiles
- Assignment-scoped child records and access revocation
- One-video intake with private, byte-range local playback
- Durable fake-scoring processing runs and validated suggestions
- Evidence seeking, accept/override/independent-score/dismiss/note actions, revision conflicts, and saved progress
- Server-derived summary totals, finalization locking, and read-only final records
- Educator/Admin role provisioning, child assignment, access revocation, and failed-job Admin surfaces
- Role-aware home routing plus URL-backed assessment and Admin filters

The local state and uploaded sandbox videos live under ignored `.data/`. Delete that directory to restore the deterministic sanitized fixture.

Live authentication, real child data, production video storage, the scientist service, and AWS deployment remain intentionally unconnected until the decision gates in the production-platform spec are approved. The application must first evaluate reuse of HELP Connect's sign-in; the fallback is administrator-provisioned email/password through one approved managed identity service.

Production startup fails closed while these sanitized adapters are selected. `HELP_REVIEW_SANITIZED_PRODUCTION_ACK=true` exists only for an explicitly acknowledged sanitized demonstration; it does not approve real data or turn the local adapters into production integrations.

Do not use real child data until the permission, storage, retention, deletion, and approved-vendor decisions in the requirements are resolved.

## Local Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:validate
pnpm build
```

Start the development server with `pnpm dev`. The root route resolves to sign-in or the current role's authorized workspace; there is intentionally no dashboard.

Open `/sign-in` and choose the Educator or Admin sandbox profile. Sandbox video validation accepts MP4, WebM, or MOV files up to 100 MB; those limits are local-adapter constraints, not an assertion about the unresolved production contract.

Database migration commands read `DATABASE_URL` through `prisma.config.ts`. The example value is local-development only and does not select a production database provider.
