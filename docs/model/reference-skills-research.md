# Reference Skills Research

## Decision

The interim model needs a realistic candidate corpus before the licensed HELP 2nd Edition artifact and model-owner package arrive. The repository therefore includes a separate, source-attributed reference catalogue for model development. It is deliberately identified as `REFERENCE`; it is not named, numbered, or represented as HELP and cannot pass the real-data startup gate.

The generated artifact is `content/developmental-skills.reference.json` (version `open-reference-cdc-elof-2026-07.2`). It contains 127 milestones from 2 through 36 months. Every item carries hand-curated, item-specific enrichment: an operational observable definition, positive indicators, non-examples that name the item's actual confusable behaviors (including adjacent earlier/later milestones), required observation opportunities and materials, evidence modalities, video scoreability, prohibited inferences, and an item-specific emerging-credit boundary. Domain, scoreability, and modality are assigned explicitly per item in the build script — never inferred from label text. Rebuild deterministically with `pnpm catalog:build-reference`; the version and sha256 are pinned in `lib/help-review/help-catalog.test.ts` and `.env.example`.

## Primary Sources

### CDC Learn the Signs. Act Early.

CDC provides age-banded milestones from 2 months through 5 years in four categories: social/emotional, language/communication, cognitive, and movement/physical. CDC describes a milestone as something at least 75% of children can do by the listed age and explicitly says its materials are not a substitute for a standardized, validated developmental screening tool.

For this engineering catalogue, the 2, 4, 6, 9, 12, 15, 18, 24, 30, and 36 month pages provide the granular source concepts. All ten pages were re-fetched and cross-checked item-by-item on 2026-07-15: the catalogue covers every listed milestone with no omissions or additions. Labels are normalized into neutral model-friendly wording — including replacing CDC's alternating gendered pronouns with they/them — without changing the substantive behavior, and the application maps them into its operational domains without changing the source-age checkpoint. Each item retains its exact source URL, and the build script preserves the CDC verbatim wording alongside each normalized label for traceability.

Sources: [CDC developmental milestones](https://www.cdc.gov/act-early/milestones/index.html), [CDC milestone checklists](https://www.cdc.gov/act-early/resources/milestone-checklists.html).

### Head Start ELOF

The Head Start Early Learning Outcomes Framework supplies the more useful information architecture: domain, sub-domain, goal, developmental progression, and indicator. It also stresses that indicators should be observable and measurable, that development is integrated, and that the framework is not itself a curriculum, assessment, or checklist.

We apply those structural principles to the reference catalogue through `domain`, `strand`, `observableDefinition`, and `observableIndicators`. We do not present ELOF goals as scored assessment items.

Source: [Interactive Head Start ELOF](https://headstart.gov/interactive-head-start-early-learning-outcomes-framework-ages-birth-five).

### WHO GSED

WHO GSED is an open-access measurement package for children through 36 months. It produces a holistic developmental score and was designed for population and programmatic measurement. That makes it valuable for later construct-coverage and external-validity studies, but it is not a substitute for HELP item content or for an individual educator review workflow.

Source: [WHO Global Scales for Early Development v1.0](https://www.who.int/publications/i/item/WHO-MSD-GSED-package-v1.0-2023.1).

### HELP

HELP remains the product's governing assessment. Shine Early is the current publisher and states that HELP content cannot be reproduced without permission. The organization owns the relevant assets, but the authoritative 2nd Edition file is not present in this repository. We therefore preserve an import boundary instead of scraping, reconstructing, or inventing HELP identifiers and rules.

Source: [Shine Early HELP FAQ](https://shineearly.store/pages/faq-help-0-6).

## Video-Scoring Design

Every reference item receives one of four explicit video-scoreability values:

| Value | Meaning |
| --- | --- |
| `DIRECT` | A complete positive example can be observed directly in the clip. |
| `OPPORTUNITY_REQUIRED` | The triggering prompt, stimulus, or demonstration and the child's response must both be captured. |
| `CONTEXT_DEPENDENT` | The relevant feeding, dressing, caregiving, or classroom context must be present. |
| `NOT_RELIABLY_SCOREABLE` | A cumulative or longitudinal criterion cannot be established from one 3-5 minute clip. |

`NOT_RELIABLY_SCOREABLE` items remain in the catalogue for coverage analysis but are removed before constructing model candidate batches. For every other item, `NOT_OBSERVED` requires a recorded opportunity and response interval. Silence or absence elsewhere in a short clip is never sufficient.

Four items are classified `NOT_RELIABLY_SCOREABLE`: several-facial-expressions (9 m), about-50-words (30 m), calms-within-ten-minutes (36 m, criterion window exceeds the clip length), and understandable-most-of-the-time (36 m). Four repertoire-style items that earlier drafts excluded are instead operationalized with explicit in-clip thresholds so they stay machine-scoreable: many-different-repeated-sounds (9 m, at least two distinct reduplicated strings), knows-familiar-people (6 m, differential response to a context-identified familiar person), three-or-more-words (18 m, three distinct meaningful word approximations within the clip), and gestures-beyond-waving-and-pointing (24 m, one qualifying communicative gesture). These thresholds are project-authored operationalizations, not CDC criteria, and are documented in each item's observable definition.

No item uses an audio-only evidence modality: attributing any vocalization to the target child in a multi-child recording requires visual identification, so all vocal and speech items require `VISUAL_AND_AUDIO` evidence.

The evidence-first scorer also requires exact candidate IDs, exact ledger event IDs, a confirmed target-child actor, valid source-video timestamps, and configured confidence thresholds. Provider output cannot create new skills or change catalogue metadata.

## Source And Usage Controls

CDC states that most CDC website information is public domain but requires attribution, a non-endorsement disclaimer, and attention to source updates. The artifact includes all three and uses no CDC logo or imagery. Operational definitions and scoring guidance are original project material rather than claims that CDC authored a video assessment.

Source: [CDC use of agency materials](https://www.cdc.gov/other/agencymaterials.html).

## Production Replacement

The licensed HELP artifact should use the same enriched fields wherever the source supports them:

1. Preserve owner-issued skill IDs, codes, labels, strand hierarchy, age bounds, and source order exactly.
2. Record observable definitions, positive indicators, non-examples, required opportunities, allowed support, and credit-specific rules.
3. Mark cumulative or longitudinal criteria so a short video cannot overclaim them.
4. Include the accepted two-minus/developmental-age rule as application-owned policy rather than asking the model to improvise it.
5. Validate the immutable version and digest, then benchmark model drafts against independently double-scored educator labels before enabling real-child-data use.

No accuracy, reliability, or superiority claim should be made from the reference catalogue alone. It enables implementation and controlled testing; human-labelled agreement data is what determines whether this model is actually better.
