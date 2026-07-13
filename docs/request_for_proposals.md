Request for Proposals: Contract AI/ML Engineer and
Video Analysis Tool for Early Childhood Assessment
Project Overview
Acelero, Inc. is seeking a contractor to build a scalable, automated version of an AI-powered video
analysis tool for an early childhood, developmental and formative assessment. A working
prototype of this tool was developed in 2025 as part of an IRB-approved inter-rater reliability (IRR)
study. The goal of this engagement is twofold:
1) automate the skill detection and scoring of child observation videos aligned to the
assessment rubric and definitions at scale aligned to the assessment purpose, and
2) iteratively improve the tool’s prompt engineering and configuration to reach ≥90%
agreement between AI outputs and expert human raters to achieve AI-human reliability.
Background: The Existing Prototype
The prototype was built as a Gemini-powered AI video analysis tool with a detailed structured
prompt as part of a reliability study. For each child video, it generated two structured outputs:
• Raw Data Audit: a CSV-ready row-level skills detection table with skill ID, domain, strand, AI
confidence score, credit assignment, timestamped evidence notes, and a Draft Child
Developmental Age Level (DAL) calculation based on the score
• Rater Survey: a structured document presenting age-gated skill lists to human raters for
independent crediting, without any AI data visible, to support the reliability study.
As part of the study, reliability was calculated between AI outputs and expert raters. Results and
the study dataset will be shared with the selected contractor as part of this workstream.
Note: The prompt logic is domain-specific and sophisticated. It includes age-gated skill scoping,
developmental scanning rules, a multi-step developmental age level (DAL) calculation algorithm,
cultural and disability-informed interpretation requirements, and strict variance control to ensure
consistent outputs across runs. The contractor will receive the full prompt and all relevant source
materials to build and improve upon.
Scope of Work
1. Automated Processing Pipeline
The contractor will build a production-ready system that replaces the current manual workflow.
The system should handle batch video processing and scoring reliably at scale, automatically
match videos to child demographic records, and generate outputs for each video without
per-video manual intervention. Outputs must be stored in a structured, retrievable format.
2. AI-Human Reliability Review and Improvement
The contractor will review the existing AI-human reliability results, identify systematic error
patterns, and iteratively engineer and improve the prompt and/or model configuration until the tool
reaches ≥90% exact agreement with calibrated expert raters on a held-out validation set. All
prompt engineering and iteractions must be versioned with before/after agreement metrics. The
contractor will collaborate with Acelero’s designated content advisor throughout this workstream to
ensure all prompt changes remain grounded in the assessment framework.
3. Human-in-the-Loop Interface
A core design principle of this tool is that AI outputs support, not replace, trained human judgment.
The system must allow trained staff to review and modify AI-generated skill detections and scores,
as well as surface low-confidence detections, so we can ensure human-in-the-loop as well as
continue to learn how the system is functioning. All human overrides and corrections must be
logged in a structured, exportable format to support future model improvement and fine-tuning
efforts.
4. Deployment Approach
The solution should be built with inter-operability in mind. Data must be easily exportable in
standard formats, and the system should support API connectivity to allow for future integration
with other platforms. The contractor should recommend a deployment approach in their proposal
with this in mind.
5. Documentation and Handoff
• Technical documentation of system architecture, API integrations, and prompt engineering
and implementation
• Prompt version log with before/after reliability metrics for every iteration
• Operator guide for batch processing, output review, and workflow management
• Handoff session with Acelero’s internal team
Timeline & Payment Schedule
Payment is milestone-based. The final reliability validation payment is contingent on confirmed
≥90% agreement on the held-out validation set.
Milestone Target Date Payment
Kickoff and requirements alignment June 13, 2026 $500
Working prototype / proof of concept June 30, 2026 $2,500
First reliability benchmark July 10, 2026 $1,500
Human review interface complete July 15, 2026 $1,500
Final reliability validation (≥90% confirmed) July 27, 2026 $1,500
Final delivery and handoff July 31, 2026 $500
Total $8,000
Proposal Requirements
Proposals must include:
• Proposed technical approach for both the automation pipeline and the reliability improvement
workstream
• Recommended deployment path with rationale
• Approach to prompt engineering and iteration and reliability benchmarking, including how
the contractor will track progress against the ≥90% target
• Relevant experience with production LLM pipelines, multimodal AI APIs, and structured
output generation
• Experience with reliability or agreement metric analysis
• Ability to work at a fast pace with frequent reviews
• Proposed timeline with milestones and total budget
• At least one example and reference from a comparable project
Evaluation Criteria
Criteria Weight
Demonstrated experience with production LLM pipelines and
reliability improvement
30%
Technical approach and feasibility of proposed deployment path 25%
Approach to and credibility of path to ≥90% agreement 20%
Proposed timeline and ability to meet July 31 deadline 15%
Budget reasonableness 10%