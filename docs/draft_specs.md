Yes. For prototype speed, **all-Next.js is the right move**.

Build it as a single Next.js app with:

```txt
Next.js App Router
Server Actions / Route Handlers
Postgres + Prisma
UploadThing or S3 SDK for video uploads
Vercel Blob or S3-compatible storage
Background jobs via Inngest / Trigger.dev / simple cron worker
Gemini API for video analysis
shadcn/ui for the review dashboard
```

The architecture becomes:

```txt
Next.js app
├── Web UI
├── API routes
├── Server Actions
├── Prisma DB layer
├── AI pipeline service
├── Reliability metrics module
└── Human review interface
```

No FastAPI yet. No Python worker yet. Keep it lean.

---

## Updated prototype architecture

```txt
/app
  /dashboard
  /videos
  /videos/[id]
  /review
  /reliability
  /prompts
  /api
    /videos/upload
    /videos/process
    /ai/run
    /reliability/report

/components
  VideoPlayer.tsx
  SkillDetectionTable.tsx
  ReliabilitySummary.tsx
  PromptVersionCard.tsx
  ReviewOverridePanel.tsx

/lib
  db.ts
  gemini.ts
  prompts.ts
  scoring.ts
  reliability.ts
  storage.ts
  validators.ts

/prisma
  schema.prisma

/data
  sample-rubric.json
  sample-children.csv
  sample-human-ratings.csv
```

This still matches the RFP because they want batch processing, structured outputs, demographic matching, human review, override logging, prompt versioning, and reliability benchmarking — not a specific backend language. 

---

## Next.js-only stack

Use:

```txt
Framework: Next.js 15+
UI: shadcn/ui + Tailwind
DB: Postgres
ORM: Prisma
Auth: Clerk or Auth.js
Storage: S3 / Cloudflare R2 / Vercel Blob
AI: Google Gemini video API
Validation: Zod
Jobs: Inngest or Trigger.dev
Charts: Recharts
Tables: TanStack Table
CSV import/export: papaparse
```

For the prototype, I’d use **Inngest** for background processing. It fits Next.js cleanly and lets you trigger workflows like:

```txt
video.uploaded → process video → save AI output → calculate reliability → create review tasks
```

---

## MVP pages

### `/dashboard`

Shows:

```txt
Total videos
Processed videos
Needs review
Current AI-human agreement
Latest prompt version
Target agreement: 90%
```

### `/videos`

Upload and list videos.

Each row:

```txt
Video
Child ID
Age at observation
Status
AI run count
Needs review?
```

### `/videos/[id]`

Video detail page.

Show:

```txt
Video player
Child metadata
AI detections
Timestamped evidence
Confidence
Human rating
Agreement/disagreement
```

### `/review`

Human-in-the-loop queue.

Filters:

```txt
Low confidence
AI-human disagreement
Missing evidence
DAL calculation issue
Age-gate issue
```

### `/reliability`

The most important screen.

Show:

```txt
Exact agreement
Cohen’s kappa
Agreement by domain
Agreement by skill
False positives
False negatives
Prompt version comparison
```

### `/prompts`

Prompt version log.

Show:

```txt
Prompt v0.1
Model config
Date created
Videos tested
Exact agreement
Before/after change notes
```

---

## Prisma schema draft

```prisma
model Child {
  id                  String   @id @default(cuid())
  externalChildId     String   @unique
  dateOfBirth         DateTime?
  ageMonthsAtObs      Int?
  demographics        Json?
  videos              Video[]
  createdAt           DateTime @default(now())
}

model Video {
  id              String   @id @default(cuid())
  childId         String?
  child           Child?   @relation(fields: [childId], references: [id])
  fileUrl         String
  filename        String
  observationDate DateTime?
  durationSeconds Int?
  status          VideoStatus @default(UPLOADED)

  aiRuns          AiRun[]
  humanRatings    HumanRating[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model RubricSkill {
  id              String   @id @default(cuid())
  skillCode       String   @unique
  domain          String
  strand          String
  minAgeMonths    Int?
  maxAgeMonths    Int?
  definition      String
  scoringRules    Json?

  aiDetections    AiSkillDetection[]
  humanRatings    HumanRating[]
}

model PromptVersion {
  id              String   @id @default(cuid())
  name            String
  version         String
  promptText      String
  modelName       String
  modelConfig     Json?
  changeNotes     String?

  aiRuns          AiRun[]
  reliabilityReports ReliabilityReport[]

  createdAt       DateTime @default(now())

  @@unique([name, version])
}

model AiRun {
  id              String   @id @default(cuid())
  videoId         String
  video           Video    @relation(fields: [videoId], references: [id])

  promptVersionId String
  promptVersion   PromptVersion @relation(fields: [promptVersionId], references: [id])

  modelName       String
  modelConfig     Json?
  rawResponse     Json?
  status          AiRunStatus @default(PENDING)
  errorMessage    String?

  detections      AiSkillDetection[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model AiSkillDetection {
  id                String   @id @default(cuid())
  aiRunId           String
  aiRun             AiRun    @relation(fields: [aiRunId], references: [id])

  skillId           String
  skill             RubricSkill @relation(fields: [skillId], references: [id])

  creditAssignment  CreditAssignment
  confidence        Float
  evidenceNote      String?
  timestampStart    String?
  timestampEnd      String?
  draftDalLevel     String?
  rationale         String?

  overrides         ReviewOverride[]

  createdAt         DateTime @default(now())
}

model HumanRating {
  id                String   @id @default(cuid())
  videoId           String
  video             Video    @relation(fields: [videoId], references: [id])

  skillId           String
  skill             RubricSkill @relation(fields: [skillId], references: [id])

  raterId           String
  creditAssignment  CreditAssignment
  notes             String?

  createdAt         DateTime @default(now())
}

model ReviewOverride {
  id                String   @id @default(cuid())
  aiDetectionId     String
  aiDetection       AiSkillDetection @relation(fields: [aiDetectionId], references: [id])

  reviewerId        String
  originalCredit    CreditAssignment
  correctedCredit   CreditAssignment
  reviewerNote      String?

  createdAt         DateTime @default(now())
}

model ReliabilityReport {
  id                String   @id @default(cuid())

  promptVersionId   String
  promptVersion     PromptVersion @relation(fields: [promptVersionId], references: [id])

  datasetSplit      String
  exactAgreement    Float
  cohenKappa        Float?
  totalComparisons  Int
  confusionMatrix   Json?
  errorPatterns     Json?

  createdAt         DateTime @default(now())
}

enum VideoStatus {
  UPLOADED
  PROCESSING
  PROCESSED
  NEEDS_REVIEW
  FAILED
}

enum AiRunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum CreditAssignment {
  CREDIT
  NO_CREDIT
  UNCERTAIN
}
```

That schema is already proposal-grade.

---

## First implementation slice

Build this first:

```txt
1. Upload/register video
2. Attach child metadata manually
3. Process video with one prompt version
4. Save structured AI detections
5. Display detections beside video
6. Import human ratings CSV
7. Compute exact agreement
8. Show reliability report
```

Skip for now:

```txt
Auth
Roles
Full batch CSV import
Complex permissions
Real production deployment
Multi-tenant architecture
Fine-tuning
Advanced analytics
```

Those are later. Don’t boil the ocean.

---

## Route handler example

```ts
// app/api/videos/[videoId]/process/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runVideoAssessment } from "@/lib/ai/run-video-assessment";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    include: {
      child: true,
    },
  });

  if (!video) {
    return NextResponse.json(
      { error: "Video not found" },
      { status: 404 }
    );
  }

  const promptVersion = await db.promptVersion.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!promptVersion) {
    return NextResponse.json(
      { error: "No prompt version configured" },
      { status: 400 }
    );
  }

  const aiRun = await runVideoAssessment({
    video,
    child: video.child,
    promptVersion,
  });

  return NextResponse.json({
    aiRunId: aiRun.id,
    status: aiRun.status,
  });
}
```

---

## Zod schema for AI output

```ts
// lib/validators/ai-assessment-output.ts

import { z } from "zod";

export const AiAssessmentOutputSchema = z.object({
  videoId: z.string(),
  childId: z.string().nullable(),
  promptVersion: z.string(),
  model: z.string(),
  detections: z.array(
    z.object({
      skillId: z.string(),
      domain: z.string(),
      strand: z.string(),
      creditAssignment: z.enum(["CREDIT", "NO_CREDIT", "UNCERTAIN"]),
      confidence: z.number().min(0).max(1),
      evidence: z.array(
        z.object({
          timestampStart: z.string().optional(),
          timestampEnd: z.string().optional(),
          note: z.string(),
        })
      ),
      draftDalLevel: z.string().optional(),
      rationale: z.string().optional(),
    })
  ),
  lowConfidenceFlags: z.array(
    z.object({
      skillId: z.string(),
      reason: z.string(),
    })
  ).default([]),
});

export type AiAssessmentOutput = z.infer<typeof AiAssessmentOutputSchema>;
```

---

## Reliability calculation in TypeScript

```ts
// lib/reliability.ts

type Credit = "CREDIT" | "NO_CREDIT" | "UNCERTAIN";

type Comparison = {
  skillId: string;
  domain: string;
  aiCredit: Credit;
  humanCredit: Credit;
};

export function calculateExactAgreement(comparisons: Comparison[]) {
  if (comparisons.length === 0) {
    return {
      exactAgreement: 0,
      total: 0,
      agreed: 0,
    };
  }

  const agreed = comparisons.filter(
    (row) => row.aiCredit === row.humanCredit
  ).length;

  return {
    exactAgreement: agreed / comparisons.length,
    total: comparisons.length,
    agreed,
  };
}

export function calculateAgreementByDomain(comparisons: Comparison[]) {
  const grouped = new Map<string, Comparison[]>();

  for (const row of comparisons) {
    const current = grouped.get(row.domain) ?? [];
    current.push(row);
    grouped.set(row.domain, current);
  }

  return Array.from(grouped.entries()).map(([domain, rows]) => {
    const result = calculateExactAgreement(rows);

    return {
      domain,
      ...result,
    };
  });
}

export function buildConfusionMatrix(comparisons: Comparison[]) {
  const labels: Credit[] = ["CREDIT", "NO_CREDIT", "UNCERTAIN"];

  const matrix: Record<Credit, Record<Credit, number>> = {
    CREDIT: { CREDIT: 0, NO_CREDIT: 0, UNCERTAIN: 0 },
    NO_CREDIT: { CREDIT: 0, NO_CREDIT: 0, UNCERTAIN: 0 },
    UNCERTAIN: { CREDIT: 0, NO_CREDIT: 0, UNCERTAIN: 0 },
  };

  for (const row of comparisons) {
    matrix[row.humanCredit][row.aiCredit] += 1;
  }

  return {
    labels,
    matrix,
  };
}
```

---

## Important implementation decision

For now, treat the Next.js app as a **prototype monolith**:

```txt
UI + API + DB + AI orchestration in one app
```

But design the code so the AI runner can later become a worker service:

```txt
lib/ai/run-video-assessment.ts
```

That file should not depend on React or UI code. Keep it pure backend logic. Later, you can move it to a worker without rewriting the app.

---

## Build plan

### Phase 1: Local demo

```bash
npx create-next-app@latest acelero-assessment-workbench
cd acelero-assessment-workbench
npx shadcn@latest init
npm install prisma @prisma/client zod papaparse recharts
npm install @google/generative-ai
npx prisma init
```

### Phase 2: Core screens

```txt
/videos
/videos/[id]
/review
/reliability
/prompts
```

### Phase 3: AI processing

```txt
Upload video
Call Gemini
Validate JSON
Save AI run
Render detections
```

### Phase 4: Reliability

```txt
Import human ratings CSV
Compare AI vs human
Generate reliability report
Show prompt version performance
```

---

## The one-liner direction

Build a **Next.js Reliability Workbench**: a monolithic prototype that proves video-to-structured-score automation, human review, override logging, and prompt-versioned reliability improvement toward the 90% target.


Below is the implementation spec for the **Next.js-only prototype** matching the four generated screens:

1. **Dashboard**
2. **Video Review**
3. **Reliability Analytics**
4. **Prompts & Experiments**

The product should be positioned as an **Assessment Reliability Workbench**, not just an “AI video analyzer.” The UI must prove the RFP requirements: batch video scoring, structured AI outputs, AI-human reliability tracking, prompt/config versioning, low-confidence review, human overrides, exportable logs, and a path toward ≥90% AI-human agreement. 

---

# 1. Product Scope

## Product name

```txt
Assessment Reliability Workbench
```

## Prototype objective

Build a Next.js monolith that demonstrates:

```txt
Video ingestion
Child metadata matching
AI scoring output visualization
Human review workflow
AI-vs-human reliability metrics
Prompt/model configuration tracking
Prompt version comparison
Override logging
Structured export readiness
```

The prototype does **not** need to fully automate production batch processing yet, but the UI and database must be designed as if it can.

---

# 2. Tech Stack

Use this:

```txt
Framework: Next.js App Router
Language: TypeScript
Styling: Tailwind CSS
UI Components: shadcn/ui
Icons: lucide-react
Charts: Recharts
Tables: TanStack Table
Forms: react-hook-form + zod
Validation: zod
Database: PostgreSQL
ORM: Prisma
Storage: local mock first, S3/R2/Vercel Blob later
AI Provider: Gemini video API later, mocked JSON now
Auth: skip for prototype or use mocked user
```

Install:

```bash
npx create-next-app@latest assessment-reliability-workbench
cd assessment-reliability-workbench

npx shadcn@latest init

npm install @prisma/client prisma zod lucide-react recharts @tanstack/react-table
npm install react-hook-form @hookform/resolvers date-fns clsx tailwind-merge
npm install papaparse
```

Optional later:

```bash
npm install @google/generative-ai inngest
```

---

# 3. App Routes

Use this route structure:

```txt
app/
  layout.tsx
  page.tsx                         -> redirect to /dashboard

  dashboard/
    page.tsx

  videos/
    page.tsx
    [videoId]/
      page.tsx                     -> Video Review screen

  review/
    page.tsx                       -> Review queue list, optional for MVP

  reliability/
    page.tsx

  prompts/
    page.tsx

  settings/
    page.tsx                       -> placeholder

  api/
    videos/
      route.ts
      [videoId]/
        route.ts
        process/
          route.ts
    ai-runs/
      route.ts
    reliability/
      route.ts
    prompts/
      route.ts
      [promptVersionId]/
        route.ts
```

For now, most API routes can return seeded/mock data from `lib/mock-data.ts`. The UI should be built first. Don’t over-engineer the backend yet.

---

# 4. Global Layout Spec

All screens share the same shell.

## Desktop layout

```txt
Full viewport
Top header: 72px height
Sidebar: 260px width
Main content: remaining width
Background: #F8FAFC / slate-50
Cards: #FFFFFF
Borders: #E2E8F0 / slate-200
Primary: blue-600
Muted text: slate-500
Main text: slate-950
```

## Layout component

```txt
components/layout/app-shell.tsx
components/layout/sidebar.tsx
components/layout/top-nav.tsx
components/layout/page-header.tsx
```

## Top navigation

Must contain:

```txt
Logo mark
Product name: Assessment Reliability Workbench
Search input: "Search videos, prompts, raters..."
Keyboard hint: ⌘ K
Bell icon
User avatar
User name: Sarah Chen
Role: Admin
Dropdown caret
```

## Sidebar items

```txt
Dashboard
Videos
Review Queue + badge 32
Reliability
Prompts
Settings
```

Bottom:

```txt
Workspace card:
  BrightStart Lab
  Workspace

Help & Support
```

## Active state

```txt
Background: blue-50
Icon/text: blue-600
Rounded: 12px
```

---

# 5. Design System

## Typography

Use Inter or Geist Sans.

```ts
const typography = {
  pageTitle: "text-3xl font-semibold tracking-tight text-slate-950",
  sectionTitle: "text-base font-semibold text-slate-950",
  cardTitle: "text-sm font-medium text-slate-600",
  metricValue: "text-2xl font-semibold text-slate-950",
  body: "text-sm text-slate-600",
  small: "text-xs text-slate-500",
}
```

## Card style

```txt
rounded-2xl
border border-slate-200
bg-white
shadow-sm
```

## Buttons

Primary:

```txt
bg-blue-600 text-white hover:bg-blue-700
```

Secondary:

```txt
border border-slate-200 bg-white text-slate-700
```

Success action:

```txt
border-green-200 bg-green-50 text-green-700
```

Danger/warning alert:

```txt
border-red-200 bg-red-50 text-red-700
```

## Status badges

```txt
Completed: green
Processing: blue
Queued: slate
High priority: red
Medium priority: amber
Low priority: blue
Current: green
Candidate: purple
Archived: slate
```

---

# 6. Core Domain Types

Create:

```txt
types/domain.ts
```

```ts
export type CreditAssignment = "FULL" | "PARTIAL" | "NONE" | "UNCERTAIN";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type VideoStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "NEEDS_REVIEW" | "FAILED";

export type PromptStatus = "CURRENT" | "CANDIDATE" | "ARCHIVED";

export type Domain =
  | "Language"
  | "Social-Emotional"
  | "Cognitive"
  | "Motor"
  | "Approaches to Learning";

export type Child = {
  id: string;
  externalChildId: string;
  ageBand: string;
  ageMonths?: number;
  demographics?: Record<string, unknown>;
};

export type ObservationVideo = {
  id: string;
  filename: string;
  thumbnailUrl: string;
  videoUrl: string;
  childId: string;
  ageBand: string;
  domainFocus: Domain;
  observedAt: string;
  status: VideoStatus;
  duration: string;
  promptVersion: string;
};

export type SkillDetection = {
  id: string;
  skill: string;
  skillCode: string;
  domain: Domain;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  credit: CreditAssignment;
  evidence: string;
  timestamp: string;
  disagreement?: boolean;
  aiAssessment?: string;
  humanAssessment?: string;
};

export type EvidenceSegment = {
  id: string;
  start: string;
  end: string;
  duration: string;
  description: string;
  source: "AI Detection" | "Context" | "Human Note";
  confidenceLevel?: ConfidenceLevel;
};

export type PromptVersion = {
  id: string;
  version: string;
  model: string;
  temperature: number;
  lastUpdated: string;
  updatedBy: string;
  exactAgreement: number;
  delta?: number;
  status: PromptStatus;
  summary: string;
  changeNotes: string[];
};
```

---

# 7. Mock Data

Create:

```txt
lib/mock-data.ts
```

Use the values from the mockups.

## Dashboard metrics

```ts
export const dashboardMetrics = {
  totalVideos: 1248,
  processed: 1054,
  needsReview: 194,
  currentAgreement: 0.78,
  targetAgreement: 0.9,
};
```

## Prompt version trend

```ts
export const promptAgreementTrend = [
  { version: "v1.0", aiHuman: 0.45, primaryRaters: 0.3, kappa: 0.5 },
  { version: "v1.1", aiHuman: 0.54, primaryRaters: 0.38, kappa: 0.63 },
  { version: "v1.2", aiHuman: 0.61, primaryRaters: 0.46, kappa: 0.69 },
  { version: "v1.3", aiHuman: 0.67, primaryRaters: 0.55, kappa: 0.78 },
  { version: "v1.4", aiHuman: 0.74, primaryRaters: 0.62, kappa: 0.83 },
  { version: "v1.5", aiHuman: 0.78, primaryRaters: 0.67, kappa: 0.9 },
];
```

## Review video

```ts
export const currentVideo = {
  id: "video_2025_05_16_038",
  filename: "video_2025_05_16_038.mp4",
  ageBand: "3–4 years",
  domainFocus: "Social-Emotional",
  observedAt: "May 16, 2025 • 9:42 AM",
  duration: "04:57",
  currentTime: "01:23",
  promptVersion: "v1.5",
};
```

## Skill detections

```ts
export const skillDetections = [
  {
    id: "det_1",
    skill: "Takes turns in play or conversation",
    domain: "Social-Emotional",
    confidence: 0.92,
    confidenceLevel: "HIGH",
    credit: "FULL",
    evidence: "Observed child waiting and taking turn with peer",
    timestamp: "01:05",
  },
  {
    id: "det_2",
    skill: "Uses feeling words to describe emotions",
    domain: "Social-Emotional",
    confidence: 0.58,
    confidenceLevel: "MEDIUM",
    credit: "PARTIAL",
    evidence: "Child labeled “happy” when asked how they felt",
    timestamp: "02:18",
  },
  {
    id: "det_3",
    skill: "Seeks adult support when needed",
    domain: "Social-Emotional",
    confidence: 0.32,
    confidenceLevel: "LOW",
    credit: "NONE",
    evidence: "Adult prompt preceded request",
    timestamp: "03:02",
    disagreement: true,
    aiAssessment: "The child’s request appears to be in response to an adult prompt.",
    humanAssessment: "The child independently looked up at the teacher and requested help.",
  },
  {
    id: "det_4",
    skill: "Shares materials without prompting",
    domain: "Social-Emotional",
    confidence: 0.64,
    confidenceLevel: "MEDIUM",
    credit: "PARTIAL",
    evidence: "Child offered toy to peer",
    timestamp: "03:45",
  },
];
```

---

# 8. Dashboard Screen Spec

Route:

```txt
/dashboard
```

## Purpose

Give a fast executive overview of processing status, reliability progress, review burden, and current prompt/model configuration.

## Layout

```txt
Page title row
Date range selector
Metric cards row
Main two-column grid
Lower two-column grid
```

## Header

```txt
Title: Dashboard
Subtitle: Overview of your assessment reliability program
Date range: May 11 – May 17, 2025
```

## KPI cards

Component:

```txt
components/dashboard/metric-card.tsx
```

Props:

```ts
type MetricCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  trendLabel?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  sparklineData?: number[];
  variant?: "blue" | "green" | "amber" | "purple" | "teal";
};
```

Cards:

```txt
Total Videos: 1,248
Processed: 1,054
Needs Review: 194
Current Agreement: 0.78 / Cohen’s Kappa
Target: 0.90 / Agreement Goal
```

## Agreement chart

Component:

```txt
components/charts/agreement-version-chart.tsx
```

Use Recharts:

```txt
LineChart
XAxis: prompt version
YAxis: 0 to 1
Solid blue line: AI vs Human Overall
Dashed blue line: AI vs Human Primary Raters
ReferenceLine at 0.90 labeled Target 0.90
```

## Recent processing activity

Component:

```txt
components/dashboard/recent-processing-activity.tsx
```

Each item:

```txt
Thumbnail
Filename
Processed with v1.5 • GPT-4o
Status badge
Relative time
```

Statuses:

```txt
Completed
Processing
Queued
```

## Review Queue Preview

Component:

```txt
components/dashboard/review-queue-preview.tsx
```

Rows:

```txt
video_2025_05_16_038.mp4
3–4 years • Language
High Priority
Review button
```

## Latest Prompt & Model Configuration

Component:

```txt
components/dashboard/latest-prompt-config-card.tsx
```

Fields:

```txt
Prompt Version: v1.5
Updated May 15, 2025
Model: GPT-4o
Temperature: 0.2
Max Tokens: 2,048
Top P: 1.0
Structured Output: Enabled
```

## Dashboard acceptance criteria

```txt
Dashboard renders correctly at 1440px desktop width.
Sidebar active item is Dashboard.
Date range selector appears top-right.
All five KPI cards appear in one row.
Agreement chart includes target 0.90 reference line.
Recent activity displays at least five items.
Review queue preview displays priority badges.
Latest prompt config displays current version and model settings.
```

---

# 9. Video Review Screen Spec

Route:

```txt
/videos/[videoId]
```

## Purpose

Allow trained staff to review AI-generated skill detections, inspect timestamped evidence, compare AI and human scoring, override AI outputs, and save review decisions.

The RFP explicitly requires human-in-the-loop review, editing AI-generated skill detections and scores, surfacing low-confidence detections, and logging human overrides in exportable format. 

## Header

```txt
Back to Review Queue
Title: Video Review
Filename: video_2025_05_16_038.mp4
Metadata chips:
  Age Band: 3–4 years
  Domain Focus: Social-Emotional
  Observed On: May 16, 2025 • 9:42 AM
Navigation:
  Previous
  4 of 32
  Next
```

## Main layout

```txt
Top row:
  Left: video player + selected skill review
  Right: AI Skill Detections table

Middle action row:
  Accept AI
  Override
  Flag for discussion
  Save Review

Bottom row:
  Evidence Segments table
  DAL Summary card
```

## Video player component

```txt
components/video/video-player-card.tsx
```

For prototype:

```txt
Use static thumbnail image
Overlay fake controls
Progress bar
Timestamp: 01:23 / 04:57
Controls: play, volume, 1.0x, CC, settings, fullscreen
```

Later replace with actual:

```tsx
<video controls src={video.videoUrl} />
```

## Low-confidence alert

```txt
Low confidence detection
One or more skills have low AI confidence. Please review carefully.
```

Component:

```txt
components/review/low-confidence-alert.tsx
```

## AI Skill Detections panel

Component:

```txt
components/review/skill-detections-table.tsx
```

Columns:

```txt
Skill
Domain
Confidence
Credit
Evidence
Timestamp
```

Row behaviors:

```txt
Click row selects skill.
Disagreement row is tinted red.
Low-confidence row shows red badge.
Selected row expands or triggers details panel below.
```

Confidence badges:

```txt
High: confidence >= 0.75
Medium: 0.40 to 0.74
Low: < 0.40
```

Credit badges:

```txt
Full: green
Partial: amber
None: red
Uncertain: slate
```

## Disagreement alert

Appears under table when selected skill has disagreement:

```txt
Disagreement detected: AI and human do not agree on credit for this skill.
Show details
```

## Selected Skill Review panel

Component:

```txt
components/review/selected-skill-review-card.tsx
```

Content:

```txt
Selected Skill for Review
Badge: Disagreement
Skill: Seeks adult support when needed
AI Confidence: 0.32 Low

AI Assessment:
  Credit: None
  The child’s request appears to be in response to an adult prompt.

Human Assessment:
  Credit: Partial
  The child independently looked up at the teacher and requested help.

Add reviewer note (optional)
```

## Review actions

Component:

```txt
components/review/review-actions.tsx
```

Buttons:

```txt
Accept AI (None)
Override
Flag for discussion
Save Review
Dropdown caret
```

Behavior:

```txt
Accept AI:
  creates review decision with correctedCredit = aiCredit

Override:
  opens dialog with corrected credit:
    Full
    Partial
    None
    Uncertain
  note field required

Flag:
  marks detection as needsDiscussion = true

Save Review:
  persists all local review decisions
```

## Override dialog

Component:

```txt
components/review/override-dialog.tsx
```

Fields:

```txt
Original AI Credit
Corrected Credit select
Reviewer Note textarea
Reason select:
  AI over-credit
  AI under-credit
  Ambiguous evidence
  Audio unclear
  Age-gate issue
  Rubric interpretation
  Other
```

## Evidence Segments

Component:

```txt
components/review/evidence-segments-table.tsx
```

Columns:

```txt
Start
End
Duration
Description
Source
Confidence
```

Rows:

```txt
02:54 - 03:08 / 00:14
Child looks up at teacher and says, “Can you help me?”...
Source: AI Detection
Confidence: Low
```

Actions:

```txt
Play segment
Add evidence segment
```

## DAL Summary

Component:

```txt
components/review/dal-summary-card.tsx
```

Fields:

```txt
Domain: Social-Emotional
Total Skills: 6

Full Credit: 2 (33%)
Partial Credit: 2 (33%)
No Credit: 1 (17%)
Not Observed: 1 (17%)

Overall DAL Score: 0.67
Label: Moderate
```

Use Recharts:

```txt
PieChart / Donut chart
Progress bar
```

## Footer metadata

```txt
Video ID: video_2025_05_16_038.mp4
Prompt Version: v1.5
Reviewed by: Sarah Chen
Last saved: 2 min ago
```

## Video Review acceptance criteria

```txt
Video Review screen renders video, metadata, AI detections, and DAL summary.
Low-confidence detection is visually obvious.
Disagreement row is visually obvious.
Selecting a detection updates the selected skill review card.
Override dialog allows corrected score and note.
Save Review logs review state.
Evidence segment table supports play-icon affordance.
```

---

# 10. Reliability Analytics Screen Spec

Route:

```txt
/reliability
```

## Purpose

Show whether prompt/model versions are improving toward target reliability, where disagreement happens, and what error patterns need prompt/config/rubric work.

The RFP asks for reliability benchmarking, systematic error pattern identification, before/after agreement metrics, and tracking progress toward the ≥90% target. 

## Header

```txt
Title: Reliability
Subtitle: Deep-dive into agreement quality and rater consistency across your assessment program.
```

## Filter row

Component:

```txt
components/reliability/reliability-filters.tsx
```

Filters:

```txt
Dataset Split:
  AI vs Human (Overall)
  AI vs Primary Raters
  AI vs Consensus Rater
  Rater vs Rater

Date Range:
  May 11 – May 17, 2025

Prompt Version:
  All Versions (5)
  v1.5 Current
  v1.4
  v1.3

Buttons:
  Filters
  Clear all
```

## KPI cards

```txt
Exact Agreement: 68.7%
Cohen’s Kappa: 0.78
False Positives: 7.3%
False Negatives: 5.1%
```

Each has:

```txt
Icon
Value
Week-over-week delta
Sparkline
```

## Agreement Across Prompt Versions

Component:

```txt
components/reliability/agreement-prompt-version-card.tsx
```

Chart:

```txt
Line 1: Exact Agreement %
Line 2: Cohen’s Kappa
X-axis: v1.0 to v1.5
Y-axis: percentage / kappa
```

Include link:

```txt
View prompt version details →
```

## Agreement by Domain

Component:

```txt
components/reliability/agreement-by-domain-card.tsx
```

Horizontal bar chart:

```txt
Safety: 82.4%
Instruction Following: 76.8%
Accuracy: 68.1%
Context Understanding: 64.3%
Tone & Style: 59.7%
Factuality: 54.2%
Completeness: 51.6%
```

Note: In final product, replace generic labels like Safety/Factuality with actual assessment domains/strands. For prototype, these can stay as placeholder analytics labels, but better names for this job would be:

```txt
Social-Emotional
Language
Cognitive
Motor
Approaches to Learning
DAL Calculation
Age-Gated Eligibility
```

Better domain chart for this job:

```ts
export const agreementByDomain = [
  { domain: "Social-Emotional", agreement: 82.4 },
  { domain: "Language", agreement: 76.8 },
  { domain: "Cognitive", agreement: 68.1 },
  { domain: "Motor", agreement: 64.3 },
  { domain: "Approaches to Learning", agreement: 59.7 },
  { domain: "DAL Calculation", agreement: 54.2 },
];
```

## Confusion Matrix

Component:

```txt
components/reliability/confusion-matrix-card.tsx
```

Display 2x2 matrix:

```txt
Human Positive / AI Positive: True Positive
Human Positive / AI Negative: False Negative
Human Negative / AI Positive: False Positive
Human Negative / AI Negative: True Negative
```

Values:

```txt
True Positive: 532
False Negative: 48
False Positive: 76
True Negative: 592
```

For this assessment product, rename labels:

```txt
Human Credit / AI Credit
Human Credit / AI No Credit
Human No Credit / AI Credit
Human No Credit / AI No Credit
```

## Top Disagreement Patterns

Component:

```txt
components/reliability/disagreement-patterns-table.tsx
```

Columns:

```txt
Pattern
Example
Count
% of Disagreements
Impact on Kappa
```

Use assessment-specific rows:

```txt
Prompted vs independent behavior
"Child requested help after teacher cue"
142
18.7%
-0.08

Partial-credit boundary
"Behavior observed but incomplete"
97
12.8%
-0.05

Age-gate mismatch
"Skill outside eligible age band"
86
11.3%
-0.04

Ambiguous audio
"Child speech unclear"
73
9.6%
-0.04

DAL calculation mismatch
"Score changed level threshold"
61
8.0%
-0.03
```

## Improvement Insights

Component:

```txt
components/reliability/improvement-insights-card.tsx
```

Columns:

```txt
Error Cause
Description
Frequency
% of Errors
Trend
```

Rows:

```txt
Ambiguous / Borderline Cases
Missing Context
Age-Gate Interpretation
Prompted Behavior Confusion
Over-crediting
Under-crediting
```

## Reliability acceptance criteria

```txt
Reliability page renders all filters.
KPI cards show exact agreement, kappa, false positives, false negatives.
Prompt version chart shows upward trend.
Agreement by domain chart displays domain-level performance.
Confusion matrix uses AI-vs-human labels.
Disagreement patterns table uses assessment-specific error categories.
Improvement insights list includes frequency and trend sparklines.
```

---

# 11. Prompts & Experiments Screen Spec

Route:

```txt
/prompts
```

## Purpose

Manage prompt versions, compare model configurations, track before/after reliability metrics, and promote a prompt version to current.

The RFP specifically requires prompt engineering iterations to be versioned with before/after agreement metrics. 

## Header

```txt
Title: Prompts & Experiments
Subtitle: Manage prompt versions, track experiments, and monitor performance over time.
```

## Actions

```txt
Create New Version
Duplicate
Compare
More
```

Right side:

```txt
All Models dropdown
Search versions...
```

## Prompt Versions Table

Component:

```txt
components/prompts/prompt-version-table.tsx
```

Columns:

```txt
Version
Model
Temperature
Last Updated
Exact Agreement
Status
```

Rows:

```txt
v1.5 / GPT-4o / 0.2 / May 15, 2025 / 0.90 / Current
v1.4 / GPT-4o / 0.2 / May 10, 2025 / 0.83 / Archived
v1.3 / GPT-4 Turbo / 0.2 / May 6, 2025 / 0.78 / Archived
v1.2 / GPT-4 Turbo / 0.3 / May 2, 2025 / 0.75 / Archived
v1.1 / GPT-4 / 0.3 / Apr 28, 2025 / 0.76 / Candidate
v1.0 / GPT-4 / 0.3 / Apr 24, 2025 / 0.72 / Archived
```

Note: For the actual proposal, use Gemini in text because their existing prototype was Gemini-powered. In the UI mockup you can still display GPT-4o, but I’d change production copy to:

```txt
Gemini 2.5 Pro
Gemini 1.5 Pro
Gemini 1.5 Flash
```

Better prototype model rows:

```txt
v1.5 / Gemini 2.5 Pro / 0.2 / 0.90 / Current
v1.4 / Gemini 2.5 Pro / 0.2 / 0.83 / Archived
v1.3 / Gemini 1.5 Pro / 0.2 / 0.78 / Archived
```

## Selected Prompt Detail Panel

Component:

```txt
components/prompts/prompt-version-detail-panel.tsx
```

Header:

```txt
v1.5
Current badge
Ellipsis button
Close button
```

Actions:

```txt
Promote to Current
Compare
```

Sections:

```txt
Prompt Summary
Change Notes
Structured Output Settings
Before / After
```

## Prompt Summary

Text:

```txt
Evaluate age-gated developmental skill evidence from the observation video. Score each eligible skill using the rubric definitions, timestamped evidence, confidence level, and DAL calculation rules.
```

Link:

```txt
View full prompt
```

## Change Notes

```txt
Clarified age appropriateness criteria with examples
Added explicit scoring scale definitions
Strengthened evidence timestamp requirements
Improved structured output schema
Added stricter uncertainty handling
```

## Structured Output Settings

```txt
Schema Version: 1.2
Max Tokens: 2,048
Top P: 1.0
Structured Output: Enabled
```

## Before / After

```txt
Exact Agreement: 0.90 / +0.07
Cohen’s Kappa: 0.78 / +0.06
Needs Review: 194 / -28 (14%)
```

## Performance Trend

Component:

```txt
components/prompts/prompt-performance-trend-card.tsx
```

Line chart:

```txt
v1.0: 0.72
v1.1: 0.76
v1.2: 0.75
v1.3: 0.78
v1.4: 0.83
v1.5: 0.90
```

## Experiment Comparison

Component:

```txt
components/prompts/experiment-comparison-card.tsx
```

Cards:

```txt
Current: v1.5 / Gemini 2.5 Pro / Temp 0.2 / Exact Agreement 0.90
Candidate: v1.1 / Gemini 1.5 Pro / Temp 0.3 / Exact Agreement 0.76
Select another version to compare
```

## Create New Version Dialog

Component:

```txt
components/prompts/create-prompt-version-dialog.tsx
```

Fields:

```txt
Base version
New version name
Model
Temperature
Top P
Max tokens
Prompt text
Change notes
Structured output schema version
```

Actions:

```txt
Save as Candidate
Run Benchmark
Cancel
```

## Promote to Current behavior

When clicked:

```txt
Confirm dialog:
  "Promote v1.5 to current?"
  This will make v1.5 the default prompt for future video processing.

Actions:
  Cancel
  Promote
```

## Prompts acceptance criteria

```txt
Prompt table renders all versions and statuses.
Selecting a row updates the right detail panel.
Current version is visually highlighted.
Performance chart matches selected metric.
Before/after metrics are visible.
Create New Version dialog opens.
Promote to Current opens confirmation.
```

---

# 12. Prisma Schema

Use this as the actual database foundation.

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  role      UserRole @default(REVIEWER)
  createdAt DateTime @default(now())

  reviewOverrides ReviewOverride[]
  promptVersions  PromptVersion[]
}

model Child {
  id              String   @id @default(cuid())
  externalChildId String   @unique
  dateOfBirth     DateTime?
  ageMonths       Int?
  demographics    Json?
  videos          Video[]
  createdAt       DateTime @default(now())
}

model Video {
  id              String      @id @default(cuid())
  filename        String
  fileUrl         String
  thumbnailUrl    String?
  childId         String?
  child           Child?      @relation(fields: [childId], references: [id])
  ageBand         String?
  domainFocus     String?
  observedAt      DateTime?
  durationSeconds Int?
  status          VideoStatus @default(QUEUED)

  aiRuns          AiRun[]
  humanRatings    HumanRating[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model RubricSkill {
  id            String   @id @default(cuid())
  skillCode     String   @unique
  domain        String
  strand        String
  minAgeMonths  Int?
  maxAgeMonths  Int?
  definition    String
  scoringRules  Json?

  aiDetections  AiSkillDetection[]
  humanRatings  HumanRating[]
}

model PromptVersion {
  id            String       @id @default(cuid())
  version       String       @unique
  name          String
  modelName     String
  temperature   Float
  topP          Float?
  maxTokens     Int?
  promptText    String
  summary       String?
  changeNotes   Json?
  schemaVersion String?
  status        PromptStatus @default(CANDIDATE)

  createdById   String?
  createdBy     User?        @relation(fields: [createdById], references: [id])

  aiRuns        AiRun[]
  reports       ReliabilityReport[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model AiRun {
  id              String      @id @default(cuid())
  videoId         String
  video           Video       @relation(fields: [videoId], references: [id])

  promptVersionId String
  promptVersion   PromptVersion @relation(fields: [promptVersionId], references: [id])

  modelName       String
  modelConfig     Json?
  rawResponse     Json?
  status          AiRunStatus @default(PENDING)
  errorMessage    String?

  detections      AiSkillDetection[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model AiSkillDetection {
  id               String           @id @default(cuid())

  aiRunId          String
  aiRun            AiRun            @relation(fields: [aiRunId], references: [id])

  skillId          String
  skill            RubricSkill      @relation(fields: [skillId], references: [id])

  confidence       Float
  creditAssignment CreditAssignment
  evidenceNote     String?
  timestampStart   String?
  timestampEnd     String?
  rationale        String?
  draftDalLevel    String?

  reviewOverrides  ReviewOverride[]

  createdAt        DateTime @default(now())
}

model HumanRating {
  id               String           @id @default(cuid())

  videoId          String
  video            Video            @relation(fields: [videoId], references: [id])

  skillId          String
  skill            RubricSkill      @relation(fields: [skillId], references: [id])

  raterId          String
  creditAssignment CreditAssignment
  notes            String?

  createdAt        DateTime @default(now())

  @@unique([videoId, skillId, raterId])
}

model ReviewOverride {
  id                String           @id @default(cuid())

  aiDetectionId     String
  aiDetection       AiSkillDetection @relation(fields: [aiDetectionId], references: [id])

  reviewerId        String
  reviewer          User             @relation(fields: [reviewerId], references: [id])

  originalCredit    CreditAssignment
  correctedCredit   CreditAssignment
  reason            String?
  reviewerNote      String?
  needsDiscussion   Boolean          @default(false)

  createdAt         DateTime @default(now())
}

model ReliabilityReport {
  id                String        @id @default(cuid())

  promptVersionId   String
  promptVersion     PromptVersion @relation(fields: [promptVersionId], references: [id])

  datasetSplit      String
  exactAgreement    Float
  cohenKappa        Float?
  falsePositiveRate Float?
  falseNegativeRate Float?
  totalComparisons  Int
  confusionMatrix   Json?
  domainBreakdown   Json?
  errorPatterns     Json?

  createdAt         DateTime @default(now())
}

enum UserRole {
  ADMIN
  CONTENT_ADVISOR
  REVIEWER
}

enum VideoStatus {
  QUEUED
  PROCESSING
  COMPLETED
  NEEDS_REVIEW
  FAILED
}

enum AiRunStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum PromptStatus {
  CURRENT
  CANDIDATE
  ARCHIVED
}

enum CreditAssignment {
  FULL
  PARTIAL
  NONE
  UNCERTAIN
}
```

---

# 13. Component Inventory

Create these files:

```txt
components/layout/app-shell.tsx
components/layout/sidebar.tsx
components/layout/top-nav.tsx
components/layout/page-header.tsx

components/common/status-badge.tsx
components/common/metric-card.tsx
components/common/sparkline.tsx
components/common/confidence-badge.tsx
components/common/credit-badge.tsx
components/common/empty-state.tsx

components/dashboard/dashboard-metric-row.tsx
components/dashboard/agreement-overview-card.tsx
components/dashboard/recent-processing-activity.tsx
components/dashboard/review-queue-preview.tsx
components/dashboard/latest-prompt-config-card.tsx

components/video/video-player-card.tsx

components/review/skill-detections-table.tsx
components/review/low-confidence-alert.tsx
components/review/selected-skill-review-card.tsx
components/review/review-actions.tsx
components/review/override-dialog.tsx
components/review/evidence-segments-table.tsx
components/review/dal-summary-card.tsx

components/reliability/reliability-filters.tsx
components/reliability/reliability-kpi-row.tsx
components/reliability/agreement-prompt-version-card.tsx
components/reliability/agreement-by-domain-card.tsx
components/reliability/confusion-matrix-card.tsx
components/reliability/disagreement-patterns-table.tsx
components/reliability/improvement-insights-card.tsx

components/prompts/prompt-version-table.tsx
components/prompts/prompt-version-detail-panel.tsx
components/prompts/prompt-performance-trend-card.tsx
components/prompts/experiment-comparison-card.tsx
components/prompts/create-prompt-version-dialog.tsx
```

---

# 14. Reliability Utility Functions

Create:

```txt
lib/reliability.ts
```

```ts
export type Credit = "FULL" | "PARTIAL" | "NONE" | "UNCERTAIN";

export type ReliabilityComparison = {
  videoId: string;
  skillId: string;
  domain: string;
  aiCredit: Credit;
  humanCredit: Credit;
};

export function calculateExactAgreement(rows: ReliabilityComparison[]) {
  if (rows.length === 0) {
    return {
      exactAgreement: 0,
      total: 0,
      agreed: 0,
    };
  }

  const agreed = rows.filter((row) => row.aiCredit === row.humanCredit).length;

  return {
    exactAgreement: agreed / rows.length,
    total: rows.length,
    agreed,
  };
}

export function calculateByDomain(rows: ReliabilityComparison[]) {
  const map = new Map<string, ReliabilityComparison[]>();

  for (const row of rows) {
    const current = map.get(row.domain) ?? [];
    current.push(row);
    map.set(row.domain, current);
  }

  return Array.from(map.entries()).map(([domain, domainRows]) => ({
    domain,
    ...calculateExactAgreement(domainRows),
  }));
}

export function buildCreditConfusionMatrix(rows: ReliabilityComparison[]) {
  const labels: Credit[] = ["FULL", "PARTIAL", "NONE", "UNCERTAIN"];

  const matrix = Object.fromEntries(
    labels.map((human) => [
      human,
      Object.fromEntries(labels.map((ai) => [ai, 0])),
    ])
  ) as Record<Credit, Record<Credit, number>>;

  for (const row of rows) {
    matrix[row.humanCredit][row.aiCredit] += 1;
  }

  return {
    labels,
    matrix,
  };
}

export function calculateBinaryCreditMetrics(rows: ReliabilityComparison[]) {
  const isCredit = (credit: Credit) => credit === "FULL" || credit === "PARTIAL";

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const row of rows) {
    const ai = isCredit(row.aiCredit);
    const human = isCredit(row.humanCredit);

    if (ai && human) tp += 1;
    else if (ai && !human) fp += 1;
    else if (!ai && human) fn += 1;
    else tn += 1;
  }

  const total = tp + fp + tn + fn;

  return {
    truePositive: tp,
    falsePositive: fp,
    trueNegative: tn,
    falseNegative: fn,
    falsePositiveRate: fp + tn === 0 ? 0 : fp / (fp + tn),
    falseNegativeRate: fn + tp === 0 ? 0 : fn / (fn + tp),
    total,
  };
}
```

---

# 15. AI Output Schema

Create:

```txt
lib/schemas/ai-assessment-output.ts
```

```ts
import { z } from "zod";

export const AiAssessmentOutputSchema = z.object({
  videoId: z.string(),
  childId: z.string().nullable(),
  promptVersion: z.string(),
  model: z.string(),
  detections: z.array(
    z.object({
      skillCode: z.string(),
      domain: z.string(),
      strand: z.string(),
      creditAssignment: z.enum(["FULL", "PARTIAL", "NONE", "UNCERTAIN"]),
      confidence: z.number().min(0).max(1),
      evidence: z.array(
        z.object({
          timestampStart: z.string(),
          timestampEnd: z.string(),
          note: z.string(),
        })
      ),
      draftDalLevel: z.string().optional(),
      rationale: z.string().optional(),
    })
  ),
  lowConfidenceFlags: z.array(
    z.object({
      skillCode: z.string(),
      reason: z.string(),
    })
  ),
});
```

---

# 16. Implementation Order

Build in this order. Don’t get cute.

## Phase 1: Static UI shell

```txt
App shell
Sidebar
Top nav
Shared card styles
Mock data
```

## Phase 2: Dashboard

```txt
Metric cards
Agreement chart
Recent activity
Review queue preview
Prompt config card
```

## Phase 3: Video Review

```txt
Video player mock
AI detections table
Low-confidence alert
Selected skill review
Evidence segments
DAL summary
Review actions
Override dialog
```

## Phase 4: Reliability

```txt
Filters
KPI cards
Prompt version chart
Domain chart
Confusion matrix
Disagreement table
Improvement insights
```

## Phase 5: Prompts

```txt
Prompt version table
Prompt detail panel
Performance chart
Experiment comparison
Create version dialog
Promote confirmation
```

## Phase 6: Database wiring

```txt
Prisma schema
Seed script
Replace mock data with DB queries
```

## Phase 7: AI processing stub

```txt
Process video button
Create AiRun
Use mocked Gemini-style JSON
Validate with Zod
Save detections
Mark video as NEEDS_REVIEW or COMPLETED
```

## Phase 8: Real Gemini integration

```txt
Upload video
Send prompt + video to Gemini
Parse structured output
Persist raw response
Persist normalized detections
Calculate reliability report
```

---

# 17. Seed Script Requirements

Create:

```txt
prisma/seed.ts
```

Seed:

```txt
1 admin user: Sarah Chen
1 workspace placeholder: BrightStart Lab, if you add workspace model later
6 prompt versions
5 videos
1 child
6 rubric skills
4 AI detections for selected video
3 evidence segments
human ratings for selected video
1 reliability report
```

---

# 18. MVP Definition of Done

The prototype is ready when:

```txt
/dashboard visually matches the mockup.
/videos/video_2025_05_16_038 visually matches the review mockup.
/reliability visually matches the analytics mockup.
/prompts visually matches the prompt experiment mockup.
All screens share the same shell.
All charts render from structured mock data.
Video review allows local override interaction.
Prompt version selection updates detail panel.
Reliability metrics are calculated from mock comparison rows, not hardcoded everywhere.
The codebase is clean enough to later connect real Gemini output.
```

---

# 19. Important Copy Changes Before Proposal

In the generated images, some labels are generic or mention GPT-4o. For this job, change them.

Replace:

```txt
GPT-4o
```

With:

```txt
Gemini 2.5 Pro
```

Replace generic reliability labels like:

```txt
Safety
Instruction Following
Factuality
Tone & Style
```

With assessment-specific labels:

```txt
Social-Emotional
Language
Cognitive
Motor
Approaches to Learning
Age-Gated Skill Eligibility
DAL Calculation
```

Replace generic disagreement examples with:

```txt
Prompted vs independent behavior
Partial-credit boundary
Age-gate mismatch
Ambiguous audio
Missing context
DAL calculation mismatch
Cultural/contextual interpretation ambiguity
Disability-informed interpretation ambiguity
```

That makes the UI feel tailored to the RFP instead of a repurposed moderation dashboard. Tiny detail, huge credibility difference.
