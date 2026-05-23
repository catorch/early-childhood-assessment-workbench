import type {
  AiSkillDetection,
  ChildRecord,
  HumanRating,
  PromptVersion,
  ReliabilityReport,
  ReliabilityTrendPoint,
  RubricSkill,
  VideoRecord
} from "@/lib/types";

export const children: ChildRecord[] = [
  {
    id: "child_1001",
    externalChildId: "BSL-1001",
    ageMonths: 45,
    ageBand: "3-4 years",
    classroom: "Maple Room"
  },
  {
    id: "child_1002",
    externalChildId: "BSL-1002",
    ageMonths: 31,
    ageBand: "2-3 years",
    classroom: "Cedar Room"
  },
  {
    id: "child_1003",
    externalChildId: "BSL-1003",
    ageMonths: 50,
    ageBand: "4-5 years",
    classroom: "Willow Room"
  }
];

export const rubricSkills: RubricSkill[] = [
  {
    id: "skill_turn_taking",
    skillCode: "SE-TURN-01",
    name: "Takes turns in play or conversation",
    domain: "Social-Emotional",
    strand: "Peer Interaction",
    definition:
      "Child waits for a peer or adult conversational/play turn and then responds without taking over the activity.",
    minAgeMonths: 24,
    maxAgeMonths: 60,
    scoringRules: [
      "Full credit requires independent turn waiting and reciprocal response.",
      "Partial credit may be assigned when an adult cue is needed.",
      "No credit when the child does not wait or no turn-taking opportunity appears."
    ],
    productionReady: true
  },
  {
    id: "skill_feeling_words",
    skillCode: "SE-EMO-02",
    name: "Uses feeling words to describe emotions",
    domain: "Social-Emotional",
    strand: "Emotional Literacy",
    definition: "Child names a feeling or emotional state for self, peer, or character in context.",
    minAgeMonths: 30,
    maxAgeMonths: 60,
    scoringRules: [
      "Full credit requires spontaneous and contextually appropriate feeling language.",
      "Partial credit applies when the feeling word is prompted.",
      "No credit when the label is absent or unrelated."
    ],
    productionReady: true
  },
  {
    id: "skill_adult_support",
    skillCode: "SE-HELP-03",
    name: "Seeks adult support when needed",
    domain: "Social-Emotional",
    strand: "Self-Regulation",
    definition:
      "Child appropriately requests help or reassurance from an adult after encountering a problem or uncertainty.",
    minAgeMonths: 24,
    maxAgeMonths: 60,
    scoringRules: [
      "Full credit requires a child-initiated request tied to a clear need.",
      "Partial credit applies when the request follows a direct adult prompt.",
      "No credit when adult support precedes the child request or the need is unclear."
    ],
    productionReady: true
  },
  {
    id: "skill_shares_materials",
    skillCode: "SE-SHARE-04",
    name: "Shares materials without prompting",
    domain: "Social-Emotional",
    strand: "Peer Interaction",
    definition: "Child offers, passes, or makes room for shared materials without adult direction.",
    minAgeMonths: 24,
    maxAgeMonths: 60,
    scoringRules: [
      "Full credit requires unprompted sharing with a peer.",
      "Partial credit applies when sharing occurs after a peer request.",
      "No credit when sharing only follows adult instruction."
    ],
    productionReady: true
  },
  {
    id: "skill_language_sequence",
    skillCode: "LANG-SEQ-01",
    name: "Describes a sequence of events",
    domain: "Language",
    strand: "Expressive Language",
    definition: "Child uses ordered language to describe two or more connected events.",
    minAgeMonths: 36,
    maxAgeMonths: 60,
    scoringRules: [
      "Full credit requires at least two ordered events using temporal language.",
      "Partial credit applies to two events without explicit sequence words.",
      "No credit when descriptions are isolated or not interpretable."
    ],
    productionReady: true
  },
  {
    id: "skill_cognitive_sorting",
    skillCode: "COG-SORT-01",
    name: "Sorts objects by an observable attribute",
    domain: "Cognitive",
    strand: "Classification",
    definition: "Child groups objects by color, shape, size, or another visible attribute.",
    minAgeMonths: 30,
    maxAgeMonths: 60,
    scoringRules: [
      "Full credit requires a stable sort and child explanation or clear repeated behavior.",
      "Partial credit applies to incomplete but purposeful grouping.",
      "No credit when grouping appears random."
    ],
    productionReady: true
  }
];

export const promptVersions: PromptVersion[] = [
  {
    id: "prompt_v15",
    name: "Early Childhood DAL Assessment",
    version: "v1.5",
    modelName: "GPT-4o",
    temperature: 0.2,
    modelConfig: {
      temperature: 0.2,
      maxTokens: 2048,
      topP: 1,
      structuredOutput: true,
      schemaVersion: "1.2"
    },
    status: "CURRENT",
    lastUpdated: "May 15, 2025",
    author: "Sarah Chen",
    promptSummary:
      "Evaluate learning objective alignment, instructional quality, and age appropriateness. Rate each dimension on a 0-2 scale with evidence-based reasoning.",
    promptText:
      "You are evaluating early childhood observation videos against age-gated developmental rubric skills. Use only visible and audible evidence. Return structured JSON with credit assignment, confidence, evidence timestamps, rationale, and DAL summary fields.",
    changeNotes: [
      "Clarified age appropriateness criteria with examples",
      "Added explicit scoring scale definitions",
      "Strengthened instruction on evidence requirements",
      "Improved structured output schema"
    ],
    exactAgreement: 0.9,
    agreementDelta: 0.07,
    cohenKappa: 0.78,
    needsReviewCount: 194
  },
  {
    id: "prompt_v14",
    name: "Early Childhood DAL Assessment",
    version: "v1.4",
    modelName: "GPT-4o",
    temperature: 0.2,
    modelConfig: {
      temperature: 0.2,
      maxTokens: 2048,
      topP: 1,
      structuredOutput: true,
      schemaVersion: "1.1"
    },
    status: "ARCHIVED",
    lastUpdated: "May 10, 2025",
    author: "Sarah Chen",
    promptSummary: "Added stricter evidence timestamp requirements and domain-specific examples.",
    promptText: "Archive prompt text for v1.4.",
    changeNotes: ["Added stricter evidence timestamp requirements", "Expanded peer interaction examples"],
    exactAgreement: 0.83,
    agreementDelta: 0.05,
    cohenKappa: 0.72,
    needsReviewCount: 222
  },
  {
    id: "prompt_v13",
    name: "Early Childhood DAL Assessment",
    version: "v1.3",
    modelName: "GPT-4 Turbo",
    temperature: 0.2,
    modelConfig: {
      temperature: 0.2,
      maxTokens: 2048,
      topP: 1,
      structuredOutput: true,
      schemaVersion: "1.0"
    },
    status: "ARCHIVED",
    lastUpdated: "May 6, 2025",
    author: "Sarah Chen",
    promptSummary: "Introduced rubric-driven response schema.",
    promptText: "Archive prompt text for v1.3.",
    changeNotes: ["Introduced rubric-driven response schema"],
    exactAgreement: 0.78,
    agreementDelta: 0.03,
    cohenKappa: 0.61,
    needsReviewCount: 247
  },
  {
    id: "prompt_v12",
    name: "Early Childhood DAL Assessment",
    version: "v1.2",
    modelName: "GPT-4 Turbo",
    temperature: 0.3,
    modelConfig: {
      temperature: 0.3,
      maxTokens: 2048,
      topP: 1,
      structuredOutput: true,
      schemaVersion: "1.0"
    },
    status: "ARCHIVED",
    lastUpdated: "May 2, 2025",
    author: "David Lee",
    promptSummary: "Rebalanced domain weighting and added DAL guidance.",
    promptText: "Archive prompt text for v1.2.",
    changeNotes: ["Rebalanced domain weighting and added DAL guidance"],
    exactAgreement: 0.75,
    agreementDelta: -0.01,
    cohenKappa: 0.54,
    needsReviewCount: 266
  },
  {
    id: "prompt_v11",
    name: "Early Childhood DAL Assessment",
    version: "v1.1",
    modelName: "GPT-4",
    temperature: 0.3,
    modelConfig: {
      temperature: 0.3,
      maxTokens: 2048,
      topP: 1,
      structuredOutput: true,
      schemaVersion: "0.9"
    },
    status: "CANDIDATE",
    lastUpdated: "Apr 28, 2025",
    author: "David Lee",
    promptSummary: "Candidate prompt retained for regression testing.",
    promptText: "Archive prompt text for v1.1.",
    changeNotes: ["Added first candidate prompt comparison"],
    exactAgreement: 0.76,
    agreementDelta: 0.04,
    cohenKappa: 0.47,
    needsReviewCount: 280
  },
  {
    id: "prompt_v10",
    name: "Early Childhood DAL Assessment",
    version: "v1.0",
    modelName: "GPT-4",
    temperature: 0.3,
    modelConfig: {
      temperature: 0.3,
      maxTokens: 2048,
      topP: 1,
      structuredOutput: true,
      schemaVersion: "0.8"
    },
    status: "ARCHIVED",
    lastUpdated: "Apr 24, 2025",
    author: "David Lee",
    promptSummary: "Initial baseline prompt.",
    promptText: "Archive prompt text for v1.0.",
    changeNotes: ["Initial baseline prompt"],
    exactAgreement: 0.72,
    cohenKappa: 0.35,
    needsReviewCount: 315
  }
];

const thumbnailBase = "https://images.unsplash.com";

export const videos: VideoRecord[] = [
  {
    id: "video_2025_05_16_038",
    filename: "video_2025_05_16_038.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_16_038.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1544776193-352d25ca82cd?auto=format&fit=crop&w=720&q=80`,
    status: "NEEDS_REVIEW",
    datasetSplit: "validation",
    childId: "child_1001",
    externalChildId: "BSL-1001",
    ageBand: "3-4 years",
    domainFocus: "Social-Emotional",
    observedOn: "2025-05-16T09:42:00.000Z",
    observedAtLabel: "May 16, 2025 • 9:42 AM",
    durationSeconds: 297,
    uploadedAt: "2025-05-16T11:10:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 2,
    detectionCount: 4,
    reviewPriority: "HIGH",
    priorityReason: "AI-human disagreement"
  },
  {
    id: "video_2025_05_16_041",
    filename: "video_2025_05_16_041.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_16_041.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=720&q=80`,
    status: "NEEDS_REVIEW",
    datasetSplit: "validation",
    childId: "child_1002",
    externalChildId: "BSL-1002",
    ageBand: "2-3 years",
    domainFocus: "Social-Emotional",
    observedOn: "2025-05-16T10:04:00.000Z",
    observedAtLabel: "May 16, 2025 • 10:04 AM",
    durationSeconds: 241,
    uploadedAt: "2025-05-16T11:15:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 1,
    detectionCount: 3,
    reviewPriority: "MEDIUM",
    priorityReason: "Low-confidence detection"
  },
  {
    id: "video_2025_05_16_043",
    filename: "video_2025_05_16_043.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_16_043.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=720&q=80`,
    status: "NEEDS_REVIEW",
    datasetSplit: "calibration",
    childId: "child_1001",
    externalChildId: "BSL-1001",
    ageBand: "3-4 years",
    domainFocus: "Cognitive",
    observedOn: "2025-05-16T10:29:00.000Z",
    observedAtLabel: "May 16, 2025 • 10:29 AM",
    durationSeconds: 198,
    uploadedAt: "2025-05-16T11:20:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 1,
    detectionCount: 3,
    reviewPriority: "LOW",
    priorityReason: "DAL data gap"
  },
  {
    id: "video_2025_05_17_001",
    filename: "video_2025_05_17_001.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_17_001.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=720&q=80`,
    status: "COMPLETED",
    datasetSplit: "validation",
    childId: "child_1003",
    externalChildId: "BSL-1003",
    ageBand: "4-5 years",
    domainFocus: "Language",
    observedOn: "2025-05-17T09:02:00.000Z",
    observedAtLabel: "May 17, 2025 • 9:02 AM",
    durationSeconds: 265,
    uploadedAt: "2025-05-17T09:50:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 1,
    detectionCount: 6
  },
  {
    id: "video_2025_05_17_002",
    filename: "video_2025_05_17_002.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_17_002.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=720&q=80`,
    status: "COMPLETED",
    datasetSplit: "validation",
    childId: "child_1001",
    externalChildId: "BSL-1001",
    ageBand: "3-4 years",
    domainFocus: "Social-Emotional",
    observedOn: "2025-05-17T09:08:00.000Z",
    observedAtLabel: "May 17, 2025 • 9:08 AM",
    durationSeconds: 224,
    uploadedAt: "2025-05-17T09:55:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 1,
    detectionCount: 6
  },
  {
    id: "video_2025_05_17_003",
    filename: "video_2025_05_17_003.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_17_003.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=720&q=80`,
    status: "COMPLETED",
    datasetSplit: "training",
    childId: "child_1002",
    externalChildId: "BSL-1002",
    ageBand: "2-3 years",
    domainFocus: "Cognitive",
    observedOn: "2025-05-17T09:15:00.000Z",
    observedAtLabel: "May 17, 2025 • 9:15 AM",
    durationSeconds: 302,
    uploadedAt: "2025-05-17T10:02:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 1,
    detectionCount: 6
  },
  {
    id: "video_2025_05_17_004",
    filename: "video_2025_05_17_004.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_17_004.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=720&q=80`,
    status: "PROCESSING",
    datasetSplit: "validation",
    childId: "child_1003",
    externalChildId: "BSL-1003",
    ageBand: "4-5 years",
    domainFocus: "Language",
    observedOn: "2025-05-17T09:22:00.000Z",
    observedAtLabel: "May 17, 2025 • 9:22 AM",
    durationSeconds: 277,
    uploadedAt: "2025-05-17T10:08:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 1,
    detectionCount: 0
  },
  {
    id: "video_2025_05_17_005",
    filename: "video_2025_05_17_005.mp4",
    fileUrl: "/mock-video-storage/video_2025_05_17_005.mp4",
    thumbnailUrl: `${thumbnailBase}/photo-1610484826967-09c5720778c7?auto=format&fit=crop&w=720&q=80`,
    status: "UPLOADED",
    datasetSplit: "calibration",
    childId: "child_1001",
    externalChildId: "BSL-1001",
    ageBand: "3-4 years",
    domainFocus: "Social-Emotional",
    observedOn: "2025-05-17T09:30:00.000Z",
    observedAtLabel: "May 17, 2025 • 9:30 AM",
    durationSeconds: 188,
    uploadedAt: "2025-05-17T10:15:00.000Z",
    promptVersionId: "prompt_v15",
    aiRunCount: 0,
    detectionCount: 0
  }
];

export const detections: AiSkillDetection[] = [
  {
    id: "det_turn_taking_038",
    videoId: "video_2025_05_16_038",
    aiRunId: "run_038_v15",
    skillId: "skill_turn_taking",
    skillCode: "SE-TURN-01",
    skillName: "Takes turns in play or conversation",
    domain: "Social-Emotional",
    strand: "Peer Interaction",
    credit: "CREDIT",
    humanCredit: "CREDIT",
    confidence: 0.92,
    evidenceSummary: "Observed child waiting and taking turn with peer",
    timestamp: "01:05",
    rationale: "The child waits for the peer to finish and then responds by placing a bead after the peer's move.",
    reviewFlags: [],
    needsReview: false,
    evidenceSegments: [
      {
        id: "ev_turn_1",
        start: "01:00",
        end: "01:12",
        duration: "00:12",
        description: "Child pauses while peer uses the materials, then resumes after peer finishes.",
        source: "AI Detection"
      }
    ]
  },
  {
    id: "det_feeling_038",
    videoId: "video_2025_05_16_038",
    aiRunId: "run_038_v15",
    skillId: "skill_feeling_words",
    skillCode: "SE-EMO-02",
    skillName: "Uses feeling words to describe emotions",
    domain: "Social-Emotional",
    strand: "Emotional Literacy",
    credit: "PARTIAL_CREDIT",
    humanCredit: "PARTIAL_CREDIT",
    confidence: 0.58,
    evidenceSummary: "Child labeled happy when asked how they felt",
    timestamp: "02:18",
    rationale: "The feeling word is present, but it follows a direct adult question rather than spontaneous labeling.",
    reviewFlags: ["Medium confidence"],
    needsReview: false,
    evidenceSegments: [
      {
        id: "ev_feel_1",
        start: "02:14",
        end: "02:21",
        duration: "00:07",
        description: "Teacher asks how the child feels; child answers with a feeling word.",
        source: "AI Detection",
        flag: "Medium"
      }
    ]
  },
  {
    id: "det_adult_support_038",
    videoId: "video_2025_05_16_038",
    aiRunId: "run_038_v15",
    skillId: "skill_adult_support",
    skillCode: "SE-HELP-03",
    skillName: "Seeks adult support when needed",
    domain: "Social-Emotional",
    strand: "Self-Regulation",
    credit: "NO_CREDIT",
    humanCredit: "PARTIAL_CREDIT",
    confidence: 0.32,
    evidenceSummary: "Adult prompt preceded request",
    timestamp: "03:02",
    rationale: "The child's request appears to be in response to an adult prompt rather than independently initiated.",
    reviewFlags: ["Low confidence", "AI-human disagreement"],
    needsReview: true,
    evidenceSegments: [
      {
        id: "ev_help_1",
        start: "02:54",
        end: "03:08",
        duration: "00:14",
        description: 'Child looks up at teacher and says, "Can you help me?" after teacher guidance.',
        source: "AI Detection",
        flag: "Low"
      },
      {
        id: "ev_help_2",
        start: "01:10",
        end: "01:18",
        duration: "00:08",
        description: "Child appears to look at materials, then at teacher, without making a request.",
        source: "Context"
      },
      {
        id: "ev_help_3",
        start: "03:09",
        end: "03:18",
        duration: "00:09",
        description: "Teacher provides assistance immediately after child's request.",
        source: "Context"
      }
    ]
  },
  {
    id: "det_shares_038",
    videoId: "video_2025_05_16_038",
    aiRunId: "run_038_v15",
    skillId: "skill_shares_materials",
    skillCode: "SE-SHARE-04",
    skillName: "Shares materials without prompting",
    domain: "Social-Emotional",
    strand: "Peer Interaction",
    credit: "PARTIAL_CREDIT",
    humanCredit: "PARTIAL_CREDIT",
    confidence: 0.64,
    evidenceSummary: "Child offered toy to peer",
    timestamp: "03:45",
    rationale: "The child passes a material to the peer after a peer gesture, which supports partial credit.",
    reviewFlags: ["Medium confidence"],
    needsReview: false,
    evidenceSegments: [
      {
        id: "ev_share_1",
        start: "03:42",
        end: "03:49",
        duration: "00:07",
        description: "Child moves a shared material toward peer after peer reaches for it.",
        source: "AI Detection",
        flag: "Medium"
      }
    ]
  },
  {
    id: "det_language_041",
    videoId: "video_2025_05_16_041",
    aiRunId: "run_041_v15",
    skillId: "skill_language_sequence",
    skillCode: "LANG-SEQ-01",
    skillName: "Describes a sequence of events",
    domain: "Language",
    strand: "Expressive Language",
    credit: "PARTIAL_CREDIT",
    humanCredit: "NO_CREDIT",
    confidence: 0.44,
    evidenceSummary: "Possible two-step description with unclear ordering",
    timestamp: "00:58",
    rationale: "The child describes two actions, but sequence language is faint and ambiguous.",
    reviewFlags: ["Low confidence", "AI-human disagreement"],
    needsReview: true,
    evidenceSegments: []
  }
];

export const humanRatings: HumanRating[] = detections
  .filter((detection) => detection.humanCredit)
  .map((detection, index) => ({
    id: `rating_${index + 1}`,
    videoId: detection.videoId,
    skillId: detection.skillId,
    raterId: index % 2 === 0 ? "rater_mlopez" : "rater_jpatel",
    credit: detection.humanCredit ?? "UNCERTAIN",
    notes: detection.needsReview ? "Independent rating differs from model output." : "Independent rating matched model output."
  }));

export const reliabilityTrend: ReliabilityTrendPoint[] = [
  { version: "v1.0", label: "v1.0", exactAgreement: 0.5, cohenKappa: 0.33, aiHumanOverall: 0.45, aiHumanPrimary: 0.3 },
  { version: "v1.1", label: "v1.1", exactAgreement: 0.64, cohenKappa: 0.44, aiHumanOverall: 0.54, aiHumanPrimary: 0.37 },
  { version: "v1.2", label: "v1.2", exactAgreement: 0.7, cohenKappa: 0.55, aiHumanOverall: 0.61, aiHumanPrimary: 0.46 },
  { version: "v1.3", label: "v1.3", exactAgreement: 0.78, cohenKappa: 0.64, aiHumanOverall: 0.68, aiHumanPrimary: 0.55 },
  { version: "v1.4", label: "v1.4", exactAgreement: 0.83, cohenKappa: 0.69, aiHumanOverall: 0.74, aiHumanPrimary: 0.62 },
  {
    version: "v1.5",
    label: "v1.5 (Current)",
    exactAgreement: 0.9,
    cohenKappa: 0.78,
    aiHumanOverall: 0.78,
    aiHumanPrimary: 0.66
  }
];

export const reliabilityReport: ReliabilityReport = {
  id: "report_prompt_v15_validation",
  promptVersionId: "prompt_v15",
  datasetSplit: "validation",
  exactAgreement: 0.687,
  cohenKappa: 0.78,
  falsePositiveRate: 0.073,
  falseNegativeRate: 0.051,
  totalComparisons: 1248,
  agreed: 857,
  disagreements: 391,
  target: 0.9,
  targetMet: false,
  confusionMatrix: {
    Positive: {
      Positive: 532,
      Negative: 48
    },
    Negative: {
      Positive: 76,
      Negative: 592
    }
  },
  byDomain: [
    { domain: "Safety", exactAgreement: 0.824 },
    { domain: "Instruction Following", exactAgreement: 0.768 },
    { domain: "Accuracy", exactAgreement: 0.681 },
    { domain: "Context Understanding", exactAgreement: 0.643 },
    { domain: "Tone & Style", exactAgreement: 0.597 },
    { domain: "Factuality", exactAgreement: 0.542 },
    { domain: "Completeness", exactAgreement: 0.516 }
  ],
  topDisagreementPatterns: [
    {
      pattern: "Borderline Safety - Threatening (low severity)",
      example: "You're so dumb, go away.",
      count: 142,
      percent: 18.7,
      impact: -0.08
    },
    {
      pattern: "Factuality - Minor Inaccuracy",
      example: "The Eiffel Tower is in Berlin.",
      count: 97,
      percent: 12.8,
      impact: -0.05
    },
    {
      pattern: "Instruction Following - Partial Compliance",
      example: "Provides some but not all requested steps.",
      count: 86,
      percent: 11.3,
      impact: -0.04
    },
    {
      pattern: "Tone - Sarcasm / Irony",
      example: "Great job breaking everything.",
      count: 73,
      percent: 9.6,
      impact: -0.04
    },
    {
      pattern: "Context Understanding - Ambiguous Intent",
      example: "I can't wait for the next episode.",
      count: 61,
      percent: 8,
      impact: -0.03
    }
  ],
  improvementInsights: [
    {
      cause: "Ambiguous / Borderline Cases",
      description: "Raters disagree most when content is subjective or lacks clear signals.",
      frequency: 289,
      percentOfErrors: 30.2,
      trend: "up"
    },
    {
      cause: "Missing Context",
      description: "Raters infer differently when key context is unavailable.",
      frequency: 176,
      percentOfErrors: 18.4,
      trend: "up"
    },
    {
      cause: "Policy Interpretation",
      description: "Inconsistent application of guideline boundaries.",
      frequency: 165,
      percentOfErrors: 17.3,
      trend: "down"
    },
    {
      cause: "Low Severity Signals",
      description: "Minor violations are rated inconsistently across raters.",
      frequency: 131,
      percentOfErrors: 13.7,
      trend: "down"
    },
    {
      cause: "Over-flagging",
      description: "Some raters flag benign content more often.",
      frequency: 95,
      percentOfErrors: 9.9,
      trend: "up"
    }
  ]
};

export const recentActivity = [
  { videoId: "video_2025_05_17_001", status: "COMPLETED", label: "Completed", timeAgo: "2 min ago" },
  { videoId: "video_2025_05_17_002", status: "COMPLETED", label: "Completed", timeAgo: "5 min ago" },
  { videoId: "video_2025_05_17_003", status: "COMPLETED", label: "Completed", timeAgo: "8 min ago" },
  { videoId: "video_2025_05_17_004", status: "PROCESSING", label: "Processing", timeAgo: "12 min ago" },
  { videoId: "video_2025_05_17_005", status: "QUEUED", label: "Queued", timeAgo: "15 min ago" }
] as const;

export function getCurrentPrompt() {
  return promptVersions.find((prompt) => prompt.status === "CURRENT") ?? promptVersions[0];
}

export function getVideoById(videoId: string) {
  return videos.find((video) => video.id === videoId);
}

export function getChildForVideo(video: VideoRecord) {
  return children.find((child) => child.id === video.childId);
}

export function getSkillById(skillId: string) {
  return rubricSkills.find((skill) => skill.id === skillId);
}

export function getDetectionsForVideo(videoId: string) {
  return detections.filter((detection) => detection.videoId === videoId);
}

export function getReviewQueue() {
  return videos
    .filter((video) => video.status === "NEEDS_REVIEW")
    .sort((a, b) => priorityWeight(b.reviewPriority) - priorityWeight(a.reviewPriority));
}

export function getDashboardStats() {
  return {
    totalVideos: 1248,
    processed: 1054,
    needsReview: 194,
    currentAgreement: 0.78,
    target: 0.9
  };
}

export function getDalSummary(videoId: string) {
  const videoDetections = getDetectionsForVideo(videoId);
  const totalSkills: number = 6;
  const fullCredit = videoDetections.filter((detection) => detection.credit === "CREDIT").length;
  const partialCredit = videoDetections.filter((detection) => detection.credit === "PARTIAL_CREDIT").length;
  const noCredit = videoDetections.filter((detection) => detection.credit === "NO_CREDIT").length;
  const notObserved = Math.max(totalSkills - fullCredit - partialCredit - noCredit, 0);
  const score = totalSkills === 0 ? 0 : (fullCredit + partialCredit * 0.5) / totalSkills;

  return {
    totalSkills,
    fullCredit,
    partialCredit,
    noCredit,
    notObserved,
    score
  };
}

function priorityWeight(priority?: string) {
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  if (priority === "LOW") return 1;
  return 0;
}
