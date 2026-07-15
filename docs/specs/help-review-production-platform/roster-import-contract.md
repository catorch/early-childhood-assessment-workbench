# HELP Review Roster Import Contract

Version: `help-roster-v1`  
Updated: July 15, 2026

## Boundary

Roster onboarding is a controlled operator import, not a public or ordinary Admin upload surface. It creates or updates children by stable external child ID and reconciles explicit Educator assignments against already provisioned staff. It never creates credentials, silently provisions an unknown Educator, deletes assessments, or deactivates records merely because they are absent from a file.

The input is UTF-8 CSV with the exact headers in `roster-template.csv`, no more than 1 MB or 5,000 data rows. A file is validated in full before any write. Preview is the default; `--apply` is required to mutate state.

## Fields

| Field | Contract |
|---|---|
| `child_external_id` | Required stable identifier, 1-100 printable characters |
| `age_months` | Required integer from 0 through 72 |
| `support_context` | `NONE_REPORTED`, `IFSP`, `DISABILITY`, `IFSP_AND_DISABILITY`, or `UNKNOWN` |
| `context_label` | Optional approved display label, at most 160 characters |
| `processing_allowed` | Required `true` or `false` |
| `child_active` | Required `true` or `false` |
| `educator_email` | Optional exact email of an already provisioned Educator |
| `assignment_active` | Required `true` or `false` when an educator email is present; otherwise blank |

Repeated child rows are allowed for multiple Educators only when every child/context field is identical. A child-educator pair may appear once. An inactive child cannot receive an active assignment. Activating an assignment requires an active user and access provision.

## Reconciliation

- Child creation and update are keyed by `child_external_id`; existing assessments retain their immutable context snapshot.
- An explicitly inactive child is retained, hidden from active roster projections, and has every active assignment revoked.
- Assignment rows create, activate, or revoke exactly the named pair. Missing assignments are unchanged.
- Missing children are unchanged. This merge rule prevents an incomplete spreadsheet from becoming a destructive full replacement.
- The raw file is never stored. A SHA-256-derived opaque import ID supplies replay detection and one allowlisted `ROSTER_IMPORTED` support event.
- Reapplying the same file is safe and reasserts the same desired state without duplicating records or audit events.

## Operation

Preview against local or configured durable state:

```bash
pnpm roster:import -- --file ./roster.csv --actor-id user-admin-1
```

Apply after reviewing the preview summary:

```bash
pnpm roster:import -- --file ./roster.csv --actor-id user-admin-1 --apply
```

The actor must be an active, provisioned Admin. Output contains only the opaque import ID and aggregate counts. Validation output names row, field, and safe error; it does not echo cell contents.
