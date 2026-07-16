# HELP Catalogue Artifact Contract

## Purpose

`help-catalog-v1` is the application/model boundary for versioned HELP content. It lets the content owner deliver the licensed catalogue without a code change and prevents the web service, processor, and persisted assessment from silently using different content versions.

The checked-in `content/help-catalog.sanitized.json` is an eight-skill engineering fixture. `content/developmental-skills.reference.json` is a 127-item, source-attributed CDC/ELOF development corpus. Neither is the authoritative HELP catalogue, and real-data mode rejects both.

## Required Artifact

The artifact is UTF-8 JSON, no larger than 10 MB, with these top-level fields:

| Field | Contract |
| --- | --- |
| `schemaVersion` | Exactly `help-catalog-v1` |
| `catalogVersion` | Non-empty immutable owner-issued version, maximum 160 characters |
| `status` | `AUTHORITATIVE` for real-data use; `SANITIZED_FIXTURE` for deterministic UI fixtures; `REFERENCE` for non-HELP model research |
| `sourceReference` | Owner/license/release reference without secret material |
| `attribution`, `disclaimer`, `sourceReferences` | Optional provenance and usage controls required for externally sourced reference material |
| `creditDefinitions` | Exactly one definition for each of `PRESENT`, `EMERGING`, `NOT_OBSERVED`, and `NOT_APPLICABLE`, including symbol, label, and description |
| `selectionPolicy` | Inclusive age behavior, standard/supported downward windows, fallback/max candidate bounds, and the resolved two-minus decision plus reference |
| `skills` | One or more ordered skills with stable ID, code, name, domain, nullable strand, inclusive minimum/maximum age in months, and unique zero-based or otherwise unique source order |

Skills may additionally provide `sourceFramework`, `sourceReferenceUrl`, `sourceAgeMonths`, `videoScoreability`, `observableDefinition`, `observableIndicators`, `nonExamples`, `observationConditions`, `prohibitedInferences`, `evidenceModalities`, and credit-specific criteria. These fields are sent to the evidence-first classifier and should be populated from owner-approved content rather than improvised at runtime.

`videoScoreability` is one of `DIRECT`, `OPPORTUNITY_REQUIRED`, `CONTEXT_DEPENDENT`, or `NOT_RELIABLY_SCOREABLE`. Longitudinal-only items remain available for coverage review but are excluded from automated short-video candidate batches.

Skill IDs, skill codes, and source-order values must each be unique. Maximum age cannot be lower than minimum age. Unknown fields, missing credits, mismatched versions, invalid JSON, duplicates, and files over the size limit fail closed.

## Intake And Verification

1. Place the owner-issued file under `content/` without changing it during a release.
2. Run `pnpm catalog:validate <path>`. Record only the returned schema version, catalogue version, status, skill count, byte count, and SHA-256 digest.
3. Set `HELP_REVIEW_HELP_CATALOG_PATH` to its image-relative path, `HELP_REVIEW_HELP_CATALOG_VERSION` to the exact internal version, and `HELP_REVIEW_HELP_CATALOG_SHA256` to that accepted digest.
4. Run scoring contract fixtures against that same version and resolve every validation difference with the content/model owner. Do not massage IDs or labels in application code.
5. Build both images. Each Docker image contains the `content/` directory, and both services verify the same immutable version at startup.
6. Create new assessments only after the new image is active. Drain or finish assessments tied to an older version before changing the configured catalogue.

`HELP_REVIEW_REAL_DATA_ENABLED=true` additionally requires an `AUTHORITATIVE` artifact, explicit path/version/digest, managed identity, and accepted production scoring configuration. The sanitized fixture remains available only for deterministic development and test states.

## Model Boundary

The processor sends the age/support-context-selected candidate projection, including provenance and observable-scoring guidance when supplied. Credit definitions and selection policy remain application-owned inputs. Model output is cross-validated against the exact immutable request, so a result cannot invent or rename a skill, change its order, or cite evidence outside the video duration.

For model development with the open reference corpus:

```bash
pnpm catalog:build-reference
pnpm catalog:validate content/developmental-skills.reference.json
```

Set the path, version, and digest printed by those commands together. The reference corpus is useful for pipeline and false-positive evaluation only; it must never be relabelled as HELP or used to unlock real-child-data mode.
