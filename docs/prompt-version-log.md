# Prompt Version Log

## v1.5 Current

- Model: GPT-4o
- Temperature: 0.2
- Structured output schema: 1.2
- Exact agreement: 0.90
- Cohen's kappa: 0.78
- Needs review: 194

Change notes:

- Clarified age appropriateness criteria with examples.
- Added explicit scoring scale definitions.
- Strengthened instruction on evidence requirements.
- Improved structured output schema.

Known failure modes:

- Adult-prompted help requests can be overcorrected to no credit.
- Medium confidence emotional language still needs reviewer attention when the label follows a direct adult question.
- Missing context remains a top source of rater disagreement.

## v1.4 Archived

- Model: GPT-4o
- Temperature: 0.2
- Exact agreement: 0.83
- Cohen's kappa: 0.72

Change notes:

- Added stricter evidence timestamp requirements.
- Expanded peer interaction examples.

## v1.3 Archived

- Model: GPT-4 Turbo
- Temperature: 0.2
- Exact agreement: 0.78
- Cohen's kappa: 0.61

Change notes:

- Introduced rubric-driven response schema.

## v1.2 Archived

- Model: GPT-4 Turbo
- Temperature: 0.3
- Exact agreement: 0.75
- Cohen's kappa: 0.54

Change notes:

- Rebalanced domain weighting and added DAL guidance.

## v1.1 Candidate

- Model: GPT-4
- Temperature: 0.3
- Exact agreement: 0.76
- Cohen's kappa: 0.47

Change notes:

- Retained as a regression candidate for comparing older model behavior.

## v1.0 Archived

- Model: GPT-4
- Temperature: 0.3
- Exact agreement: 0.72
- Cohen's kappa: 0.35

Change notes:

- Initial baseline prompt.
