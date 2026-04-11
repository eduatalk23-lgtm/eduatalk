// ============================================
// AI 역량 분석 타입
// Phase 5.5a: 태그 제안 + Phase 6.1: 인라인 하이라이트
// ============================================

import type { CompetencyItemCode, CompetencyGrade, StrategyTargetArea, StrategyPriority } from "@/lib/domains/student-record/types";
import type { CompetencyAnalysisContext } from "../pipeline";

// ============================================
// 역량 분석 맥락 주입 타입 (가이드 프롬프트용)
// ============================================

/** E1: 경고 엔진 패턴 메타데이터 (severity + suggestion 포함) */
export interface GuideWarningPattern {
  /** 원본 이슈 코드 (예: "P1_나열식", "F16_진로과잉도배") */
  code: string;
  /** 경고 심각도 */
  severity: "critical" | "high" | "medium" | "low";
  /** 사람이 읽을 수 있는 제목 */
  title: string;
  /** 구체적 개선 제안 */
  suggestion: string;
}

/**
 * 가이드 프롬프트에 주입할 분석 맥락.
 * Phase 1-3(역량 분석) 결과에서 추출한 약점/이슈 정보.
 * 데이터가 없으면 undefined를 전달하고, 가이드 프롬프트에서 해당 섹션 자체를 생략.
 */
export interface GuideAnalysisContext {
  /**
   * 품질 이슈 목록 (예: "P1_나열식", "F10_성장부재").
   * 하나라도 있는 레코드의 issues만 포함.
   */
  qualityIssues: Array<{
    recordType: "setek" | "changche" | "haengteuk";
    issues: string[];
    feedback: string;
  }>;
  /** B- 이하 역량 항목 */
  weakCompetencies: CompetencyAnalysisContext[];
  /**
   * E1: 경고 엔진 패턴 (severity + suggestion 메타데이터 포함).
   * qualityIssues.issues에서 매칭된 패턴만 포함. 매칭 없으면 빈 배열 또는 undefined.
   */
  warningPatterns?: GuideWarningPattern[];
}

/** AI가 제안하는 개별 태그 */
export interface TagSuggestion {
  /** 역량 항목 코드 */
  competencyItem: CompetencyItemCode;
  /** 긍정/부정/확인필요 */
  evaluation: "positive" | "negative" | "needs_review";
  /** AI가 추출한 근거 키워드 (원문에서) */
  evidenceKeywords: string[];
  /** AI의 판단 이유 (한 문장) */
  reasoning: string;
  /** 매칭된 루브릭 질문 */
  matchedRubricQuestion: string;
}

/** suggestTags 액션의 입력 */
export interface SuggestTagsInput {
  /** 분석할 텍스트 (세특/창체/행특 내용) */
  content: string;
  /** 기록 유형 */
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  /** 과목명 (세특인 경우) */
  subjectName?: string;
  /** 학년 */
  grade?: number;
}

/** suggestTags 액션의 출력 */
export interface SuggestTagsResult {
  suggestions: TagSuggestion[];
  /** 분석 요약 (전체적인 역량 인상) */
  summary: string;
}

// ============================================
// Phase 6.1: 인라인 하이라이트 타입
// ============================================

/** 하이라이트된 구절 + 역량 태그 */
export interface HighlightTag {
  /** 역량 항목 코드 */
  competencyItem: CompetencyItemCode;
  /** 긍정/부정/확인필요 */
  evaluation: "positive" | "negative" | "needs_review";
  /** 원문에서 인용한 근거 구절 (정확한 발췌) */
  highlight: string;
  /** 판단 이유 */
  reasoning: string;
}

/** 세특 구간별 분석 결과 */
export interface AnalyzedSection {
  /** 구간 유형 */
  sectionType: "학업태도" | "학업수행능력" | "탐구활동" | "전체";
  /** 이 구간에 해당하는 원문 텍스트 (Phase 6.2 — 3구간 분리) */
  sectionText?: string;
  /** 이 구간에서 발견된 역량 태그들 */
  tags: HighlightTag[];
  /** 컨설턴트 확인 필요 여부 */
  needsReview: boolean;
}

/** 세특 하이라이트 분석 입력 */
export interface HighlightAnalysisInput {
  content: string;
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  subjectName?: string;
  grade?: number;
  /** 진로 역량 평가용: 전공(목표학과), 이수 과목, 성적 */
  careerContext?: {
    targetMajor: string;
    takenSubjects: string[];
    /** 전공 관련 과목 성적 (과목명 → 석차등급/성취도). 9등급: 숫자, 5등급: 숫자 또는 "A"~"E" */
    relevantScores: Array<{ subjectName: string; rankGrade: number | string }>;
    /** 학기별 성적 추이 (학업성취도 Q3 평가용). 9등급: 숫자, 5등급: 숫자 또는 "A"~"E" */
    gradeTrend?: Array<{ grade: number; semester: number; subjectName: string; rankGrade: number | string }>;
  };
  /**
   * Layer 0: 이전 학년 누적 프로필 카드 (이미 렌더된 prompt 섹션 문자열).
   * 1학년 또는 데이터 없음 시 omit. `buildStudentProfileCard` + `renderStudentProfileCard`로 생성.
   */
  profileCard?: string;
}

// ============================================
// Phase QA: 콘텐츠 품질 평가
// ============================================

/** AI가 평가하는 텍스트 작성 품질 점수 */
export interface ContentQualityScore {
  /** 구체성 (0-5): 구체적 사례·근거·성과가 포함된 정도 */
  specificity: number;
  /** 연결성 (0-5): 활동→과정→결과→성장의 논리적 흐름 */
  coherence: number;
  /** 깊이 (0-5): 탐구·분석의 깊이, 교과 연계, 확장적 사고 */
  depth: number;
  /** 문법 (0-5): 문법·맞춤법·표현의 적절성 */
  grammar: number;
  /** 과학적 정합성 (0-5): 개념 정확성, 논리적 비약 유무, 실험설계 타당성 */
  scientificValidity: number;
  /** 종합 점수 (0-100): specificity×25 + coherence×15 + depth×25 + grammar×10 + scientificValidity×25) / 5 */
  overallScore: number;
  /** 품질 문제 목록 (예: ["동어반복", "구체 사례 부족", "비교군 설계 오류"]) */
  issues: string[];
  /** 개선 피드백 (1-2문장) */
  feedback: string;
}

/** 세특 하이라이트 분석 출력 */
export interface HighlightAnalysisResult {
  /** 구간별 분석 (학업태도/수행능력/탐구활동) */
  sections: AnalyzedSection[];
  /** 종합 등급 제안 (루브릭 기반 bottom-up) */
  competencyGrades: {
    item: CompetencyItemCode;
    grade: CompetencyGrade;
    reasoning: string;
    /** 개별 루브릭 질문 평가 (Phase: Bottom-Up Evaluation) */
    rubricScores?: {
      questionIndex: number;
      grade: CompetencyGrade;
      reasoning: string;
    }[];
  }[];
  /** 전체 요약 */
  summary: string;
  /** Phase QA: 텍스트 작성 품질 평가 (옵션 — LLM이 누락 시 undefined) */
  contentQuality?: ContentQualityScore;
}

// ============================================
// Phase 1 (Level 4): 3-Step 분해 중간 표현 타입
// Step A(태깅) → Step B(루브릭) → Step C(품질)
// ============================================

/** Step A: confidence 메타데이터가 포함된 태그 */
export interface TagWithUncertainty {
  competencyItem: CompetencyItemCode;
  evaluation: "positive" | "negative" | "needs_review";
  highlight: string;
  reasoning: string;
  /** LLM 자체 평가 신뢰도 (0.0~1.0) */
  confidence: number;
}

/** Step A: uncertainty 메타데이터가 포함된 구간 */
export interface SectionWithUncertainty {
  sectionType: "학업태도" | "학업수행능력" | "탐구활동" | "전체";
  sectionText?: string;
  tags: TagWithUncertainty[];
  needsReview: boolean;
}

/** Step A 출력: 구간분류 + 태그추출 + confidence */
export interface StepATaggingResult {
  sections: SectionWithUncertainty[];
  /** 태그가 1개 이상 발견된 역량 항목 코드 목록 */
  coveredItems: CompetencyItemCode[];
  /** 전체 신뢰도 (0.0~1.0) — Cascading 판정에 사용 */
  overallConfidence: number;
}

/** Step B 출력: 루브릭 기반 등급 채점 */
export interface StepBRubricResult {
  competencyGrades: HighlightAnalysisResult["competencyGrades"];
  summary: string;
}

/** Step C 출력: 5축 품질 평가 */
export interface StepCQualityResult {
  contentQuality: ContentQualityScore;
}

/** 3-Step 파이프라인 토큰 사용량 추적 */
export interface PipelineStepUsage {
  stepA: { inputTokens: number; outputTokens: number } | null;
  stepB: { inputTokens: number; outputTokens: number } | null;
  stepC: { inputTokens: number; outputTokens: number } | null;
  total: { inputTokens: number; outputTokens: number };
  /** 실행 경로: "pipeline" = 3-step, "monolithic" = 기존 단일 호출 */
  path: "pipeline" | "monolithic";
}

// ============================================
// 배치 하이라이트 분석 타입
// ============================================

/** analyzeSetekBatchWithHighlight 배치 입력 (파이프라인 전용) */
export interface BatchHighlightInput {
  records: Array<{
    id: string;
    content: string;
    recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
    subjectName?: string;
    grade?: number;
  }>;
  /** 공유 진로 컨텍스트 (동일 학생) */
  careerContext?: HighlightAnalysisInput["careerContext"];
}

/** analyzeSetekBatchWithHighlight 배치 출력 */
export interface BatchHighlightResult {
  /** 성공한 레코드 (id → result) */
  succeeded: Map<string, HighlightAnalysisResult>;
  /** 실패한 레코드 ID 목록 (개별 재시도 대상) */
  failedIds: string[];
  /** Phase 0: LLM 토큰 사용량 */
  usage?: { inputTokens: number; outputTokens: number };
}

// ============================================
// Phase 7: AI 보완전략 제안 타입
// ============================================

/** AI가 제안하는 보완전략 항목 */
export interface StrategySuggestion {
  /** 보완 영역 */
  targetArea: StrategyTargetArea;
  /** 보완 전략 내용 */
  strategyContent: string;
  /** 우선순위 */
  priority: StrategyPriority;
  /** 제안 이유 (진단 근거) */
  reasoning: string;
  /** 웹 검색 출처 (Grounding) */
  sourceUrls?: string[];
}

/** suggestStrategies 액션의 입력 */
export interface SuggestStrategiesInput {
  /** 종합 진단의 약점 */
  weaknesses: string[];
  /** 부족 역량 항목 (등급 B- 이하) */
  weakCompetencies: { item: CompetencyItemCode; grade: CompetencyGrade; label: string }[];
  /** 루브릭 질문별 약점 (B- 이하 질문 목록) */
  rubricWeaknesses?: string[];
  /** 진단에서 생성된 개선 전략 (AI 시드 데이터) */
  diagnosisImprovements?: Array<{ priority: string; area: string; gap: string; action: string; outcome: string }>;
  /** 학년 */
  grade: number;
  /** 추천 전공 계열 */
  targetMajor?: string;
  /** 기존 보완전략 (중복 방지) */
  existingStrategies?: string[];
  /** 미이수 추천 과목 (교과이수적합도 기반) */
  notTakenSubjects?: string[];
  /**
   * 전 학년 세특/창체/행특 품질 패턴 집계.
   * aggregateQualityPatterns()가 반환한 반복 패턴 목록.
   * 데이터가 없으면 undefined (전략 프롬프트에서 섹션 자체를 생략).
   */
  qualityPatterns?: Array<{ pattern: string; count: number; subjects: string[] }>;
  /**
   * 대학 계열 프로필 매칭 결과 (eval/university-profile-matcher).
   * 전략 생성 시 학생의 희망 진로 적합도를 보완전략에 반영.
   */
  universityMatchContext?: string;
  /** 배정 가이드 컨텍스트 (P4-P6 탐구 방향/키워드). 없으면 프롬프트에서 생략. */
  guideContextSection?: string;
}

/** suggestStrategies 액션의 출력 */
export interface SuggestStrategiesResult {
  suggestions: StrategySuggestion[];
  /** 전체 요약 */
  summary: string;
}

// ============================================
// Phase 9.2: AI 활동 요약서 타입
// ============================================

/** generateActivitySummary 액션의 입력 */
export interface ActivitySummaryInput {
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetGrades: number[];
  recordDataByGrade: Record<
    number,
    {
      seteks: Array<{ subject_name: string; content: string }>;
      personalSeteks: Array<{ title: string; content: string }>;
      changche: Array<{ activity_type: string; content: string }>;
      haengteuk: { content: string } | null;
      readings: Array<{ book_title: string; book_author?: string }>;
    }
  >;
  storylines?: Array<{ title: string; keywords: string[] }>;
  /** Phase E2: 영역간 연결 프롬프트 섹션 */
  edgePromptSection?: string;
  /** Q3: 이전 학년 요약 (다학년 비교 성장 서술용) */
  previousSummaryText?: string;
}

/** generateActivitySummary 액션의 출력 */
export interface ActivitySummaryResult {
  title: string;
  sections: import("@/lib/domains/student-record/types").ActivitySummarySection[];
  fullText: string;
}

// ============================================
// Phase 9.3: 세특 방향 가이드 (컨설턴트 내부용)
// ============================================

/** generateSetekGuide 액션의 입력 */
export interface SetekGuideInput {
  /** "retrospective" = 기존 기록 분석, "prospective" = 계획 과목 기반 방향 제안 */
  mode?: "retrospective" | "prospective";
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetSubClassificationName?: string;
  targetMidName?: string;
  targetGrades: number[];
  recordDataByGrade: Record<
    number,
    {
      seteks: Array<{ subject_name: string; content: string }>;
      changche: Array<{ activity_type: string; content: string }>;
    }
  >;
  competencyScores?: Array<{ item: string; grade: string; narrative?: string }>;
  storylines?: Array<{ title: string; keywords: string[] }>;
  strengths?: string[];
  weaknesses?: string[];
  /** Phase E2: 영역간 연결 프롬프트 섹션 */
  edgePromptSection?: string;
  /** Phase R2: prospective 모드에서 사용 — 계획 과목 목록 */
  plannedSubjects?: Array<{ subjectName: string; grade: number; semester: number; subjectType?: string }>;
  /** Phase R2: prospective 모드에서 사용 — 가이드 배정 컨텍스트 */
  guideAssignments?: string;
  /**
   * D→B단계: 역량 분석 맥락 (Phase 1-3 결과).
   * issues/feedback/weakCompetencies를 포함하여 프롬프트에 약점 맥락 주입.
   * 없으면 해당 섹션 자체를 프롬프트에서 생략.
   */
  analysisContext?: GuideAnalysisContext;
  /** Impl-4: 이전 분석 학년의 보완방향 요약 (prospective 모드 전용) */
  crossGradeDirections?: string;
}

/** generateSetekGuide 액션의 출력 */
export interface SetekGuideResult {
  title: string;
  guides: import("@/lib/domains/student-record/types").SetekGuideItem[];
  overallDirection: string;
}

// ============================================
// Phase R1: AI 로드맵 생성
// ============================================

/** generateAiRoadmap 액션의 입력 */
export interface RoadmapGenerationInput {
  /** "planning" = 신규학생(기록없음), "analysis" = 기존학생(기록+진단) */
  mode: "planning" | "analysis";
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetSubClassificationName?: string;
  curriculumYear: number;

  // 공통 (planning + analysis)
  coursePlans?: Array<{
    subjectName: string;
    grade: number;
    semester: number;
    status: string;
    subjectType?: string;
  }>;
  storylines?: Array<{
    id: string;
    title: string;
    career_field: string | null;
    keywords: string[];
    grade_1_theme: string | null;
    grade_2_theme: string | null;
    grade_3_theme: string | null;
  }>;
  guideAssignments?: string;
  recommendedCourses?: Array<{ name: string; type: "general" | "career" | "fusion" }>;

  // analysis 모드 전용
  diagnosisImprovements?: Array<{ priority: string; area: string; action: string }>;
  diagnosisStrengths?: string[];
  diagnosisWeaknesses?: string[];
  setekGuides?: Array<{ subjectName: string; direction: string; keywords: string[] }>;
  existingActivities?: Array<{ grade: number; area: string; content: string }>;
}

// ============================================
// 창체 방향 가이드
// ============================================

/** generateChangcheGuide 액션의 입력 */
export interface ChangcheGuideInput {
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetSubClassificationName?: string;
  targetMidName?: string;
  targetGrades: number[];
  recordDataByGrade: Record<
    number,
    {
      changche: Array<{ activity_type: string; content: string }>;
      seteks: Array<{ subject_name: string; content: string }>;
      haengteuk: { content: string } | null;
    }
  >;
  competencyScores?: Array<{ item: string; grade: string; narrative?: string }>;
  storylines?: Array<{ title: string; keywords: string[] }>;
  strengths?: string[];
  weaknesses?: string[];
  /** Phase E2: 영역간 연결 프롬프트 섹션 */
  edgePromptSection?: string;
  /** 세특 방향 컨텍스트 (setek_guide 결과 요약) */
  setekGuideContext?: string;
  /**
   * D→B단계: 역량 분석 맥락 (Phase 1-3 결과).
   * issues/feedback/weakCompetencies를 포함하여 프롬프트에 약점 맥락 주입.
   */
  analysisContext?: GuideAnalysisContext;
  /** Impl-4: 이전 분석 학년의 보완방향 요약 (prospective 모드 전용) */
  crossGradeDirections?: string;
}

/** generateChangcheGuide 액션의 출력 */
export interface ChangcheGuideResult {
  title: string;
  guides: import("@/lib/domains/student-record/types").ChangcheGuideItem[];
  overallDirection: string;
}

// ============================================
// 행특 방향 가이드
// ============================================

/** generateHaengteukGuide 액션의 입력 */
export interface HaengteukGuideInput {
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetSubClassificationName?: string;
  targetMidName?: string;
  targetGrades: number[];
  recordDataByGrade: Record<
    number,
    {
      haengteuk: { content: string } | null;
      changche: Array<{ activity_type: string; content: string }>;
      seteks: Array<{ subject_name: string; content: string }>;
    }
  >;
  competencyScores?: Array<{ item: string; grade: string; narrative?: string }>;
  storylines?: Array<{ title: string; keywords: string[] }>;
  strengths?: string[];
  weaknesses?: string[];
  /** Phase E2: 영역간 연결 프롬프트 섹션 */
  edgePromptSection?: string;
  /** 창체 방향 컨텍스트 (changche_guide 결과 요약) */
  changcheGuideContext?: string;
  /**
   * D→B단계: 역량 분석 맥락 (Phase 1-3 결과).
   * issues/feedback/weakCompetencies를 포함하여 프롬프트에 약점 맥락 주입.
   */
  analysisContext?: GuideAnalysisContext;
  /** Impl-4: 이전 분석 학년의 보완방향 요약 (prospective 모드 전용) */
  crossGradeDirections?: string;
}

/** generateHaengteukGuide 액션의 출력 */
export interface HaengteukGuideResult {
  title: string;
  guide: import("@/lib/domains/student-record/types").HaengteukGuideItem;
  overallDirection: string;
}

/** generateAiRoadmap LLM 출력 */
export interface RoadmapGenerationOutput {
  items: RoadmapGeneratedItem[];
  overallStrategy: string;
}

/** LLM이 생성하는 개별 로드맵 아이템 */
export interface RoadmapGeneratedItem {
  area: string;
  grade: number;
  semester: number | null;
  plan_content: string;
  plan_keywords: string[];
  storyline_title?: string;
  rationale: string;
}
