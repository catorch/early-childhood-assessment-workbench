# Operator Guide

## 1. Dashboard

Open `/dashboard` to inspect the overall program state: total videos, processed count, review workload, current agreement, target agreement, recent processing activity, review queue preview, and the current prompt configuration.

## 2. Video Registry

Open `/videos` to review registered observation videos. The table shows child match state, age band, domain focus, processing status, AI run count, and review priority. Use the filters to narrow by status, dataset split, and review state.

The prototype registration API is:

```http
POST /api/videos
```

Required payload fields are `filename` and `fileUrl`. Optional fields include `externalChildId`, `observationDate`, and `durationSeconds`.

## 3. Child Metadata Import

Use:

```http
POST /api/children/import
```

Send JSON with a `rows` array. Each row must include `externalChildId`, `ageMonths`, and `ageBand`. Invalid rows are returned with row-level validation errors.

## 4. Processing

Use:

```http
POST /api/videos/[videoId]/process
```

The current prototype calls the mock AI provider through `lib/ai/run-video-assessment.ts`, validates the structured output with Zod, and returns detection/review flag counts. The boundary is intentionally backend-only so Gemini can replace the mock provider.

## 5. Human Review

Open `/review` for the next priority item or `/videos/[videoId]` for a direct evidence page. Reviewers can inspect the video still, AI detections, confidence, credit assignment, evidence timestamps, disagreement warning, selected skill details, and DAL summary.

Review override validation is available at:

```http
POST /api/review-overrides
```

The payload must include `aiDetectionId`, `correctedCredit`, and optional `reviewerNote`.

## 6. Human Ratings Import

Use:

```http
POST /api/human-ratings/import
```

Rows must include `videoId`, `skillId`, `raterId`, and `credit`. The route validates video and rubric references before accepting rows for reliability calculations.

## 7. Reliability

Open `/reliability` to inspect exact agreement, Cohen's kappa, false-positive and false-negative rates, trend by prompt version, domain agreement, confusion matrix, disagreement patterns, and improvement insights.

Use:

```http
GET /api/reliability
POST /api/reliability
```

`GET /api/reliability?groupBy=domain` returns grouped reliability calculations.

## 8. Prompt Experiments

Open `/prompts` to inspect prompt versions, current/candidate status, exact agreement, model configuration, change notes, structured output settings, and before/after metrics.

Prompt routes:

```http
GET /api/prompts
POST /api/prompts
GET /api/prompts/[promptVersionId]
PATCH /api/prompts/[promptVersionId]
```

The `PATCH` route supports a prototype `promote` action and checks admin role plus structured output settings.

## 9. Exports

Exports are available at:

```http
GET /api/exports/[exportType]
GET /api/exports/[exportType]?format=json
```

Supported export types are `ai-outputs`, `human-ratings`, `review-overrides`, `reliability`, and `prompt-log`.
