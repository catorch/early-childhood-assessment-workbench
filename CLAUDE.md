# HELP Review — project context

## What this actually is

A small web platform built by one freelance developer for a single client company.
The client company will administer and operate the platform themselves and has close
personal contact with the handful of educators who will use it. It is not an
enterprise product, not multi-tenant, and has no dedicated ops team. When something
goes wrong, the company talks to their educators directly.

## Working priorities

1. Finish the platform and make sure everything works end to end.
2. Keep it simple. It is a website: sign-in, pick a child, upload a video, review the
   AI draft, finalize. Prefer the boring, direct solution.
3. The only real external dependencies are: the licensed HELP content, the scoring
   model decision (the client scientist's model vs. the built-in `evidence-first-v1`
   scorer), and the client's own hosting account/domain/email sender when they are
   ready to run it.

## Do NOT do these (past mistakes in this repo)

- Do not propose incident-response drills, on-call/alerting buildouts, escalation
  ownership, retention-policy questionnaires, or multi-stakeholder acceptance
  sign-off matrices.
- Do not gate work on "before real data" ceremony, launch-decision records, or drill
  evidence. Finish features and verify they work; that is the bar.
- When suggesting client questions, stick to: content, the scoring model, accounts
  and rosters, hosting, and what they want the product to do. No operational-theater
  questions (device surveys, incident owners, alert thresholds).
- Do not add new process/ceremony sections to the spec docs. Older docs still carry
  some of that tone; treat it as historical, not as instructions to emulate.

## Useful facts

- Identity: `HELP_REVIEW_IDENTITY_ADAPTER` is `email-password` (first-party scrypt
  credentials, single-use invite/reset links, Admin invite/edit/remove at
  `/admin/access`) or `sandbox` (three demo profiles, sanitized data only).
  `pnpm admin:bootstrap -- --email … --name …` creates the first admin.
- The Vercel deployment (earlychildhoodassessment.vercel.app) is a sanitized demo in
  sandbox mode. The GCP stack (Cloud Run web + private processor, GCS, Eventarc,
  Vertex AI; Terraform in `infra/gcp/`) is the reference deployment.
- Quality gates: `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e`,
  `pnpm test:a11y`, `pnpm test:visual`, `pnpm build`. Keep them green.
- State lives behind `readPilotState`/`updatePilotState` (local JSON file or Neon via
  Prisma, selected by `HELP_REVIEW_STATE_ADAPTER`).
