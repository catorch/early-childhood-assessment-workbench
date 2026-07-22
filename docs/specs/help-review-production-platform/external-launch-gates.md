# What's Left

Updated: July 16, 2026

The platform is feature-complete and tested (unit, browser, accessibility, and visual
suites are green). The remaining work is small and mostly depends on things only the
client company can provide:

1. **HELP content** — the licensed HELP skill catalogue from the client. The import
   contract (`help-catalog-v1`, see `help-catalog-contract.md`) is ready; today the
   app runs on an open research placeholder.
2. **Scoring model** — either integrate the client scientist's (Yi's) model behind
   the existing scoring gateway, or adopt the built-in `evidence-first-v1` scorer.
   Comparing both against a few educator-scored videos is the easiest way to decide.
3. **Client hosting** — when the company is ready to run it: their hosting account
   (or keep the current setup), a domain, an email sender for invitation/reset
   emails (`HELP_REVIEW_EMAIL_ADAPTER=resend`, `RESEND_API_KEY`,
   `HELP_REVIEW_EMAIL_FROM`, `HELP_REVIEW_APP_ORIGIN`), and `pnpm admin:bootstrap`
   for their first Admin account.
4. **Real roster** — load their children and educators with `pnpm roster:import`,
   then invite the educators from `/admin/access`.
5. **Final QA pass** — click through the real flows with the real content before
   educators start using it.

Until the real content and scoring model are in, `HELP_REVIEW_REAL_DATA_ENABLED`
stays false and deployments show the sanitized-data banner.
