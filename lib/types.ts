export type CreditAssignment =
  | "CREDIT"
  | "PARTIAL_CREDIT"
  | "NO_CREDIT"
  | "NOT_OBSERVED"
  | "UNCERTAIN";

export type VideoStatus =
  | "UPLOADED"
  | "UNMATCHED"
  | "PROCESSING"
  | "COMPLETED"
  | "NEEDS_REVIEW"
  | "FAILED";

export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type PromptStatus = "CURRENT" | "CANDIDATE" | "ARCHIVED";

export type ReviewPriority = "LOW" | "MEDIUM" | "HIGH";

export type ChildRecord = {
  id: string;
  externalChildId: string;
  ageMonths: number;
  ageBand: string;
  classroom: string;
};

export type VideoRecord = {
  id: string;
  filename: string;
  fileUrl: string;
  thumbnailUrl: string;
  status: VideoStatus;
  datasetSplit: "training" | "calibration" | "validation";
  childId?: string;
  externalChildId?: string;
  ageBand: string;
  domainFocus: string;
  observedOn: string;
  observedAtLabel: string;
  durationSeconds: number;
  uploadedAt: string;
  promptVersionId?: string;
  aiRunCount: number;
  detectionCount: number;
  reviewPriority?: ReviewPriority;
  priorityReason?: string;
};

export type RubricSkill = {
  id: string;
  skillCode: string;
  name: string;
  domain: string;
  strand: string;
  definition: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  scoringRules: string[];
  productionReady: boolean;
};

export type EvidenceSegment = {
  id: string;
  start: string;
  end: string;
  duration: string;
  description: string;
  source: "AI Detection" | "Context" | "Human Rating";
  flag?: "Low" | "Medium" | "High";
};

export type AiSkillDetection = {
  id: string;
  videoId: string;
  aiRunId: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  domain: string;
  strand: string;
  credit: CreditAssignment;
  humanCredit?: CreditAssignment;
  confidence: number;
  evidenceSummary: string;
  timestamp: string;
  rationale: string;
  reviewFlags: string[];
  needsReview: boolean;
  evidenceSegments: EvidenceSegment[];
};

export type HumanRating = {
  id: string;
  videoId: string;
  skillId: string;
  raterId: string;
  credit: CreditAssignment;
  notes?: string;
};

export type PromptVersion = {
  id: string;
  name: string;
  version: string;
  modelName: string;
  temperature: number;
  modelConfig: {
    temperature: number;
    maxTokens: number;
    topP: number;
    structuredOutput: boolean;
    schemaVersion: string;
  };
  status: PromptStatus;
  lastUpdated: string;
  author: string;
  promptSummary: string;
  promptText: string;
  changeNotes: string[];
  exactAgreement: number;
  agreementDelta?: number;
  cohenKappa: number;
  needsReviewCount: number;
};

export type ReliabilityTrendPoint = {
  version: string;
  label: string;
  exactAgreement: number;
  cohenKappa: number;
  aiHumanOverall?: number;
  aiHumanPrimary?: number;
};

export type ReliabilityReport = {
  id: string;
  promptVersionId: string;
  datasetSplit: string;
  exactAgreement: number;
  cohenKappa: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  totalComparisons: number;
  agreed: number;
  disagreements: number;
  target: number;
  targetMet: boolean;
  confusionMatrix: Record<string, Record<string, number>>;
  byDomain: Array<{ domain: string; exactAgreement: number }>;
  topDisagreementPatterns: Array<{
    pattern: string;
    example: string;
    count: number;
    percent: number;
    impact: number;
  }>;
  improvementInsights: Array<{
    cause: string;
    description: string;
    frequency: number;
    percentOfErrors: number;
    trend: "up" | "down" | "flat";
  }>;
};
