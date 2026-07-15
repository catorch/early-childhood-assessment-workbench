# HELP Review Production Closure Inputs

Updated: July 15, 2026

Product, privacy, storage, vendor, and infrastructure permissions are treated as approved. The items below are no longer approval requests; they are the concrete artifacts, configuration, implementation, and execution evidence still required before real child data.

| Closure area | Required implementation or evidence | Current state | Tasks |
|---|---|---|---|
| Scientist package/service | Integrate Yi's versioned package/data contract, accepted sanitized success/error fixtures, exact model/prompt criteria, timeout/retry behavior, and deployed contract test | Vertex contract/transport and provisional fixtures implemented; Yi package/contract not yet integrated | 1.1, 12.5, 12.8 |
| HELP content | Supply the authoritative structured catalogue, resolved two-minus rule, and final-output mapping through the implemented artifact contract | `help-catalog-v1` import, validation, hashing, version snapshots, Docker packaging, real-data rejection of the eight-skill fixture, and the QA1 deployed snapshot pass; owner artifact absent | 1.4, 12.8 |
| Roster and permission | Run the versioned controlled import with the real approved roster, reconcile its preview, and retain the exact-build acceptance record | `help-roster-v1` import, validation, reconciliation, audit, template, tests, and synthetic CLI preview pass | production part of 10.1, 12.8 |
| Video/privacy configuration | Apply final vendor/region, retention, deletion, backup, lifecycle, and incident-owner values and verify them in the target bucket | Private GCS contract implemented with development lifecycle values | 1.3, 12.3, 12.8, 12.9 |
| Identity | Carry the proven managed path and exact provisioned accounts into the final organization project/domain | QA2 live provider setup, verification/reset action codes, exact linking, sign-in/logout, deactivation/reactivation, session revocation, and shared abuse limits pass; public signup remains disabled | organization portion of 1.5, 12.5 |
| Organization infrastructure | Select organization-owned Neon or Cloud SQL, then apply the existing stack to organization-owned staging/production projects and accounts with final domains, regions, secrets, support address, technical/budget owners, and transfer records | Digest-pinned QA1 and observability are applied to the Terraform-managed development project with a clean plan; configured Neon still reports AWS `us-east-1` and ownership handoff is absent | 1.5, 12.1, 12.9 |
| Recovery and incident evidence | Execute and record provider point-in-time recovery, alert/on-call receipt, and the final named privacy incident drill | Runbook, QA1 terminal-failure/metric signal, six-migration logical restore, shared-counter concurrency, QA2 immutable rollback/roll-forward, session-secret rotation, old-session rejection, and recovery sign-in pass | 12.2, 12.6, 12.7 |
| Exact-build acceptance | Run all canonical stories against the versioned staging build with the selected identity, content, roster, and scoring paths; record required user and owner acceptance | 137 of 146 stories pass; digest-pinned QA2 managed identity and QA1 provider smoke pass, while 8 stories remain partial and the permissioned staging acceptance story is incomplete | 12.8, 12.9 |

Until these closure actions are recorded:

- `HELP_REVIEW_REAL_DATA_ENABLED` remains false.
- Managed identity and Vertex development scoring accept sanitized/synthetic input only; local sandbox identity remains visibly labeled.
- Add-on flags, manual skill creation, PDF/export, alternate outputs, amendments, and parallel identity paths remain hidden and server-rejected.
- The shared development deployment is not described as organization-owned production.
