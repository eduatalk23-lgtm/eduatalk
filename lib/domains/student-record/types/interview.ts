// ============================================
// α5 면접 대응력 모듈 — 공개 타입 (Sprint 2, 2026-04-20)
//
// Sprint 1 브리프 (alpha5-interview-module-brief.md) 의 타입 스펙을 정식화.
// DB: interview_sessions + interview_question_chains + interview_answers.
// ============================================

export type InterviewSessionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "abandoned";

export type InterviewChainDepth = 1 | 2 | 3 | 4 | 5;

export type InterviewGeneratedBy = "seed" | "llm_v1";

export type InterviewAnalyzedBy = "rule_v1" | "llm_v1";

export type InterviewFocus =
  | "factual"
  | "reasoning"
  | "application"
  | "value"
  | "controversial";

export type InterviewGapKind =
  | "unsupported_claim"
  | "missing_evidence"
  | "contradiction"
  | "ess_violation";

export interface InterviewScenario {
  readonly targetMajor: string | null;
  readonly targetUniversityLevel: string | null;
  readonly focus: InterviewFocus | null;
}

export interface InterviewSession {
  readonly id: string;
  readonly tenantId: string;
  readonly studentId: string;
  readonly scenario: InterviewScenario;
  readonly status: InterviewSessionStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly scoreSummary: InterviewScoreSummary | null;
}

export interface InterviewScoreSummary {
  readonly avgConsistency: number | null;
  readonly avgAuthenticity: number | null;
  readonly gapCount: number;
  readonly aiSuspicionLevel: "low" | "medium" | "high";
}

export interface InterviewChainNode {
  readonly id: string;
  readonly sessionId: string;
  readonly rootQuestionId: string;
  readonly parentChainId: string | null;
  readonly depth: InterviewChainDepth;
  readonly questionText: string;
  readonly expectedHook: string | null;
  readonly generatedBy: InterviewGeneratedBy;
  readonly createdAt: string;
}

export interface InterviewGapFinding {
  readonly kind: InterviewGapKind;
  readonly summary: string;
  readonly sourceRecordIds: readonly string[];
}

export interface InterviewAiSignals {
  readonly jargonDensity: number; // 1~5
  readonly sentenceUniformity: number; // 1~5
  readonly vagueHedging: number; // 1~5
}

export interface InterviewAnswerAnalysis {
  readonly consistencyScore: number; // 0~100
  readonly authenticityScore: number; // 0~100
  readonly aiSignals: InterviewAiSignals;
  readonly gapFindings: readonly InterviewGapFinding[];
  readonly coachComment: string;
  readonly analyzedBy: InterviewAnalyzedBy;
  readonly analyzedAt: string;
  readonly costUsd: number | null;
}

export interface InterviewAnswer {
  readonly id: string;
  readonly chainId: string;
  readonly answerText: string;
  readonly audioUrl: string | null;
  readonly submittedAt: string;
  readonly analysis: InterviewAnswerAnalysis | null;
}
