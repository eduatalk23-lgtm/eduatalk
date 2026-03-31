// ============================================
// AI×AI 시뮬레이션 타입 정의
// ============================================

export interface SimulatedStudentProfile {
  name: string;
  grade: 1 | 2 | 3;
  schoolCategory: "general" | "autonomous_private" | "science" | "foreign_lang" | "international";
  schoolName: string;
  targetMajor: string;
  curriculumRevision: "2015 개정" | "2022 개정";
  gpa: string;
  strengths: string[];
  weaknesses: string[];
  context: string;
}

export interface SimulationScenario {
  id: string;
  difficulty: "basic" | "intermediate" | "advanced";
  category: string;
  studentProfile: SimulatedStudentProfile;
  consultantQuestion: string;
  expectedFocus: string[];
}

export interface SimulationResult {
  scenarioId: string;
  agentResponse: string;
  toolCalls: string[];
  thinkingSteps: string[];
  evaluation: {
    scores: Record<string, number>;
    feedback: string;
    missedPointsDetail: string[];
    expertAlternative: string;
  } | null;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SimulationBatchResult {
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    avgOverallScore: number;
    casesExtracted: number;
    correctionsGenerated: number;
  };
  results: SimulationResult[];
}

/** 시나리오 프리셋 */
export type ScenarioPreset =
  | "basic"        // 기본 상담 시나리오 10건
  | "edge-cases"   // 엣지 케이스 (자사고, 전환, 늦은 시기 등)
  | "admission"    // 입시 전형 특화
  | "interview"    // 면접 준비 특화
  | "all";         // 전체

// ── 교차 시뮬레이션 (파일 기반 핸드오프: Gemini API ↔ Claude Code) ──

/** 시뮬레이션에 사용 가능한 모델 식별자 */
export type SimulationModelId = "gemini" | "claude";

/** Claude Code에 전달할 프롬프트 항목 */
export interface ClaudePromptItem {
  scenarioId: string;
  category: string;
  /** agent 역할: Claude가 상담 응답 생성 */
  agentPrompt: {
    system: string;
    user: string;
  };
  /** evaluator 역할: Claude가 Gemini 응답 평가 */
  evaluatorPrompt: {
    system: string;
    user: string;
  };
  /** Gemini가 생성한 상담 응답 (evaluator 프롬프트에 포함됨) */
  geminiAgentResponse: string;
}

/** Claude Code가 저장할 응답 항목 */
export interface ClaudeResponseItem {
  scenarioId: string;
  /** Claude의 상담 응답 */
  agentResponse: string;
  /** Gemini 응답에 대한 Claude의 평가 (JSON) */
  evaluation: {
    scores: Record<string, number>;
    feedback: string;
    missedPointsDetail: string[];
    expertAlternative: string;
  } | null;
}

/** 교차 비교 결과 (한 시나리오) */
export interface CrossComparisonItem {
  scenarioId: string;
  category: string;
  gemini: {
    agentResponse: string;
    /** Gemini 응답을 Claude가 평가한 점수 */
    evaluatedBy: "claude";
    score: number;
  };
  claude: {
    agentResponse: string;
    /** Claude 응답을 Gemini가 평가한 점수 */
    evaluatedBy: "gemini";
    score: number;
  };
  scoreDelta: number; // gemini.score - claude.score
  winner: "gemini" | "claude" | "tie";
}
