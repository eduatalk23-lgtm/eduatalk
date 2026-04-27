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
  /**
   * H1 / L3-A: 과목 교차 테마 (학년 내 ≥2 과목 반복 테마).
   * dominantThemeIds 우선 노출. 없으면 가이드 프롬프트에서 섹션 자체 생략.
   */
  crossSubjectThemes?: GradeCrossSubjectThemesContext;
  /**
   * L4-E: 서사 기반 보강 우선순위 (severity 정렬) + 설계 모드 레코드 우선순위.
   * - prioritizedWeaknesses: 양 경로(pipeline / reportData) 모두 채워짐.
   * - recordPriorityOrder: reportData 경로(prospective)에서만 채워짐.
   * 데이터 부족 시 omit.
   */
  narrativeContext?: {
    prioritizedWeaknesses?: import("../pipeline/narrative-context").PrioritizedWeakness[];
    recordPriorityOrder?: import("../pipeline/narrative-context").RecordPriority[];
  };
}

/**
 * 가이드 프롬프트에 주입할 cross-subject theme 요약.
 * 전체 GradeThemeExtractionResult보다 가벼운 형태로 압축 (프롬프트 토큰 절감).
 */
export interface GradeCrossSubjectThemesContext {
  /** 학년 전체를 관통하는 dominant 테마 (최대 3개) */
  dominantThemes: Array<{
    id: string;
    label: string;
    keywords: string[];
    affectedSubjects: string[];
    subjectCount: number;
    evolutionSignal?: "deepening" | "stagnant" | "pivot" | "new";
  }>;
  /** ≥2 과목에 걸친 반복 테마 총 개수 (UI/로그 참고용) */
  crossSubjectPatternCount: number;
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

/** Step A 사전 분석: 태깅 이전 착안점 (Plan-then-Execute lite) */
export interface StepAPreAnalysis {
  mainTheme: string;
  careerLink: string;
  qualityConcerns: string;
}

/** Step A 출력: 구간분류 + 태그추출 + confidence */
export interface StepATaggingResult {
  sections: SectionWithUncertainty[];
  /** 태그가 1개 이상 발견된 역량 항목 코드 목록 */
  coveredItems: CompetencyItemCode[];
  /** 전체 신뢰도 (0.0~1.0) — Cascading 판정에 사용 */
  overallConfidence: number;
  /** 유효하지 않아 스킵된 태그 수 (디버깅용) */
  skippedTagCount?: number;
  /** 태깅 전 사전 착안점 (일관성 보강용, LLM이 누락 시 undefined) */
  preAnalysis?: StepAPreAnalysis;
}

/** Step B 출력: 루브릭 기반 등급 채점 */
export interface StepBRubricResult {
  competencyGrades: HighlightAnalysisResult["competencyGrades"];
  summary: string;
}

// ============================================
// H1 / L3-A: Cross-subject Theme Extractor
// 학년 내 여러 레코드를 한 프롬프트에 일괄 주입 → 과목 교차 테마 감지
// ============================================

/** 테마가 등장한 레코드 인용 */
export interface GradeThemeRecordRef {
  recordId: string;
  recordType: "setek" | "changche" | "haengteuk" | "personal_setek";
  subjectName?: string;
  /** 원문에서 추출한 핵심 구절 (100자 이하) */
  evidenceSnippet: string;
}

/** 학년 단위 과목 교차 테마 1건 */
export interface GradeTheme {
  /** 영문 lowercase slug (예: "social-minority", "data-modeling") */
  id: string;
  /** 사람이 읽을 수 있는 테마명 */
  label: string;
  /** 테마를 표현하는 핵심 키워드 */
  keywords: string[];
  /** 이 테마가 등장한 레코드 */
  records: GradeThemeRecordRef[];
  /** 해당 테마가 등장한 과목명 목록 (중복 제거) */
  affectedSubjects: string[];
  /** 몇 개 과목에 걸쳐 있는가 */
  subjectCount: number;
  /** 선행 학년 대비 변화 신호 (profileCard 있을 때만) */
  evolutionSignal?: "deepening" | "stagnant" | "pivot" | "new";
  /** LLM 자체 평가 확신도 0~1 */
  confidence: number;
}

/** Cross-subject Theme Extractor 출력 */
export interface GradeThemeExtractionResult {
  themes: GradeTheme[];
  themeCount: number;
  /** subjectCount >= 2 인 테마 수 */
  crossSubjectPatternCount: number;
  /** 학년 전체를 관통하는 상위 3개 테마 id */
  dominantThemeIds: string[];
  elapsedMs: number;
  /** 토큰 절감 위해 content 요약한 경우 true */
  truncationWarning?: boolean;
}

// ============================================
// H2 / L3-B: Interest Consistency Narrative
// 이전 학년 누적 데이터 → 관심 일관성 서사 1회 LLM 호출
// ============================================

/** 서사 생성에 들어가는 압축 입력 */
export interface InterestConsistencyInput {
  /** 분석 대상의 priorSchoolYears (예: [2024, 2025]) */
  priorSchoolYears: number[];
  /** 목표 전공 (있으면 진로 일관성 판단에 활용) */
  targetMajor?: string;
  /** crossGradeThemes 요약 (없으면 빈 배열) */
  themes: Array<{
    id: string;
    label: string;
    years: number[];
    affectedSubjects: string[];
  }>;
  /** 진로역량 추이 (없으면 omit) */
  careerTrajectory?: {
    byYear: Array<{ year: number; averageNumericGrade: number }>;
    trend: "rising" | "stable" | "falling";
    growthDelta: number;
  };
  /** 지속 강점 항목 (최대 5개) */
  persistentStrengths: Array<{ competencyItem: string; bestGrade: string }>;
  /** 지속 약점 항목 (최대 5개) */
  persistentWeaknesses: Array<{ competencyItem: string; worstGrade: string }>;
  /** 이전 학년 세특 요약 (subject + 핵심 1줄). 토큰 절감용 — 최대 12건 권장 */
  priorSetekHighlights?: Array<{
    schoolYear: number;
    subjectName?: string;
    snippet: string;
  }>;
}

/** Interest Consistency 서사 LLM 출력 */
export interface InterestConsistencyResult {
  narrative: string;
  sourceThemeIds: string[];
  confidence: number;
  elapsedMs: number;
}

/** Cross-subject Theme Extractor 입력 */
export interface GradeThemeExtractionInput {
  grade: number;
  targetMajor?: string;
  /** 이전 학년 profileCard 마크다운 (Layer 0) */
  profileCard?: string;
  records: Array<{
    recordId: string;
    recordType: "setek" | "changche" | "haengteuk" | "personal_setek";
    subjectName?: string;
    content: string;
    /** 사전 분석된 역량 태그 요약 (선택) */
    competencyTags?: string[];
    /** 사전 감지된 품질 이슈 코드 (선택) */
    qualityIssues?: string[];
  }>;
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
// α1-2: Volunteer Competency Analysis (봉사활동 역량 태깅)
// ============================================

/** 봉사활동 단건 요약 (LLM 프롬프트 주입용 경량 구조) */
export interface VolunteerActivitySummary {
  /** 봉사 row id */
  id: string;
  /** 시간 수 */
  hours: number;
  /** 활동 설명 (null 가능) */
  description: string | null;
  /** 활동 날짜 (null 가능, ISO string) */
  activityDate: string | null;
}

/** 봉사 역량 분석 입력 */
export interface VolunteerAnalysisInput {
  /** 분석 대상 학년 */
  grade: number;
  /** 해당 학년의 봉사 목록 (빈 배열 허용 — 시간 합계만 반환) */
  activities: VolunteerActivitySummary[];
  /** 목표 전공 (공동체역량 문맥 강화 시 활용) */
  targetMajor?: string;
  /** Layer 0 프로필 카드 (있으면 이전 학년 문맥 보완) */
  profileCard?: string;
}

/**
 * 봉사 역량 분석 출력.
 * community_caring / community_leadership 두 역량에 초점을 맞추되,
 * LLM이 다른 역량(예: career_exploration)에 적합하다고 판단하면 포함할 수 있다.
 */
export interface VolunteerAnalysisResult {
  /** 총 봉사 시간 (입력 hours 합계 — LLM 계산 아님) */
  totalHours: number;
  /** 반복 주제 (description 텍스트에서 추출한 2~5개 키워드) */
  recurringThemes: string[];
  /** 공동체 돌봄 근거 요약 (community_caring 역량, 최대 3문장) */
  caringEvidence: string[];
  /** 리더십 근거 요약 (community_leadership 역량, 최대 2문장; 없으면 빈 배열) */
  leadershipEvidence: string[];
  /** activity_tags 저장에 사용할 역량 태그 목록 */
  competencyTags: Array<{
    /** 봉사 row id (activity_tags.record_id) */
    volunteerId: string;
    /** 역량 코드 */
    competencyItem: import("@/lib/domains/student-record/types").CompetencyItemCode;
    /** 평가 방향 */
    evaluation: "positive" | "negative" | "needs_review";
    /** 근거 (1줄) */
    reasoning: string;
  }>;
  /** LLM elapsed time (ms) */
  elapsedMs: number;
}

// ============================================
// α1-4-b: 수상(Awards) 역량 태깅 타입
// ============================================

/** 수상 1건 요약 (프롬프트 입력용 — DB description 없음, 이름/수준/수여기관 중심) */
export interface AwardActivitySummary {
  /** student_record_awards.id */
  id: string;
  /** 상 이름 (필수) */
  awardName: string;
  /** 교내/교외/전국/국제 등 (null 가능) */
  awardLevel: string | null;
  /** 수여 기관 (null 가능) */
  awardingBody: string | null;
  /** 단체/개인 구분 또는 참여자 정보 (null 가능) */
  participants: string | null;
  /** 수상일 (null 가능, ISO string) */
  awardDate: string | null;
}

/** 수상 역량 분석 입력 */
export interface AwardsAnalysisInput {
  /** 분석 대상 학년 */
  grade: number;
  /** 해당 학년의 수상 목록 (빈 배열은 호출자가 short-circuit) */
  awards: AwardActivitySummary[];
  /** 목표 전공 (진로 일관성 문맥 강화) */
  targetMajor?: string;
  /** Layer 0 프로필 카드 (이전 학년 문맥) */
  profileCard?: string;
}

/**
 * 수상 역량 분석 출력.
 * community_leadership / career_exploration / academic_inquiry 3축에 초점.
 * 대입 미반영이지만 컨설팅 근거/서사로 활용.
 */
export interface AwardsAnalysisResult {
  /** 반복 주제 (상 이름에서 추출한 2~5개 키워드) */
  recurringThemes: string[];
  /** 리더십 근거 요약 (community_leadership, 최대 2문장; 없으면 빈 배열) */
  leadershipEvidence: string[];
  /** 진로 연관 근거 요약 (career_exploration, 최대 2문장; 없으면 빈 배열) */
  careerRelevance: string[];
  /** activity_tags 저장에 사용할 역량 태그 목록 */
  competencyTags: Array<{
    /** 수상 row id (activity_tags.record_id) */
    awardId: string;
    /** 역량 코드 */
    competencyItem: import("@/lib/domains/student-record/types").CompetencyItemCode;
    /** 평가 방향 */
    evaluation: "positive" | "negative" | "needs_review";
    /** 근거 (1줄) */
    reasoning: string;
  }>;
  /** LLM elapsed time (ms) */
  elapsedMs: number;
}

// ============================================
// Stage 1 (측정 루프 닫기): 오프라인 A/B 러너 메트릭
// ============================================

export type PipelineFallbackReason =
  | "confidence_below_threshold"
  | "stepB_parse_failed"
  | "stepB_failed"
  | "full_fallback";

export interface AnalyzeRunMetrics {
  path: "pipeline" | "monolithic";
  /** Cascading 판정에 사용된 Step A 종합 신뢰도 (0~1) */
  stepAConfidence?: number;
  /** Step A에서 태그가 1개 이상 발견된 역량 항목 수 */
  stepACoveredItems?: number;
  /** Step A에서 생성된 총 태그 수 */
  stepATagCount?: number;
  /** Step A 태그 중 needs_review 비율 (0~1) */
  stepANeedsReviewRatio?: number;
  /** monolithic fallback 원인 (파이프라인 경로에서만 세팅) */
  fallbackReason?: PipelineFallbackReason;
  stepUsage?: {
    stepA?: { inputTokens: number; outputTokens: number };
    stepB?: { inputTokens: number; outputTokens: number };
    stepC?: { inputTokens: number; outputTokens: number };
    monolithic?: { inputTokens: number; outputTokens: number };
  };
  latencyMs?: {
    total?: number;
    stepA?: number;
    stepB?: number;
    stepC?: number;
    monolithic?: number;
  };
}

export interface AnalyzeRunResult {
  data: HighlightAnalysisResult;
  usage?: { inputTokens: number; outputTokens: number };
  metrics: AnalyzeRunMetrics;
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
  /** Phase 1 Layer 2: 통합 테마 (hyperedge) 요약. 수렴 서사/반사실 추론 근거. */
  hyperedgeSummarySection?: string;
  /** Phase δ-6 (G11): 활성 메인 탐구 섹션. tier_plan 빈 셀 우선 채움 안내 포함. */
  mainExplorationSection?: string;
  /**
   * β 격차 1: MidPipeline Planner 메타 판정 섹션 (buildMidPlanSynthesisSection() 결과).
   * focusHypothesis / concernFlags 를 전략 방향에 반영하기 위해 주입한다.
   * undefined 이면 섹션 자체 생략 (no-op).
   */
  midPlanSynthesisSection?: string;
  /**
   * 격차 1 다학년 통합: buildMidPlanByGradeSection() 결과.
   * 학년별 focusHypothesis/override 분포를 전략에 반영. 없으면 생략.
   */
  midPlanByGradeSection?: string;
  /**
   * 격차 4: 설계 모드 AI 가안 품질 섹션 (buildProjectedQualitySection() 결과).
   * P8 draft_analysis 가 저장한 source='ai_projected' content_quality 5축 점수 + 이슈 집계.
   * 설계 모드 학년이 없거나 P8 미실행이면 undefined (no-op).
   */
  projectedQualitySection?: string;
  /**
   * 격차 6: 학종 3요소 통합 점수 섹션 (buildHakjongScoreSection() 결과).
   * α2 Reward 엔진이 계산한 학업/진로/공동체 0~100 점수.
   * 스냅샷 없거나 미계산 시 undefined (no-op).
   */
  hakjongScoreSection?: string;
  /**
   * Phase B G3: 이번 실행 학년 지배 교과 교차 테마 섹션 (buildGradeThemesSection() 결과).
   * P3.5 cross_subject_theme_extraction 이 ctx.belief.gradeThemes 에 저장한 결과.
   * gradeThemes 없거나 dominantThemeIds 비어있으면 undefined (no-op).
   */
  gradeThemesSection?: string;
  /**
   * Phase B G1: 세특 서사 완성도(8단계) 섹션 (buildNarrativeArcDiagnosisSection() 결과).
   * S2 narrative_arc_extraction 산출물 기반. 없으면 undefined (no-op).
   */
  narrativeArcSection?: string;
  /**
   * Phase B G5: 학생 정체성 프로필 카드 텍스트 (ctx.belief.profileCard).
   * P1-P3 역량 분석에서 빌드된 이전 학년 역량/품질 누적 카드.
   * undefined 또는 "" 이면 섹션 생략 (no-op).
   */
  profileCardSection?: string;
}

/** suggestStrategies 액션의 출력 */
export interface SuggestStrategiesResult {
  suggestions: StrategySuggestion[];
  /** 전체 요약 */
  summary: string;
  /** L1 validator 경고/에러 (선택) — 컨설턴트 가시화용 */
  warnings?: string[];
}

// ============================================
// Phase 9.2: AI 활동 요약서 타입
// ============================================

/**
 * B8 (2026-04-15): 시계열 모드 — 입력 콘텐츠의 출처별 분포로 결정.
 *   - "analysis": 모든 학년이 NEIS/확정 기록 기반 (기존)
 *   - "prospective": 모든 학년이 AI 가안 기반 (1학년 설계 학생 등)
 *   - "hybrid": 일부 학년만 NEIS, 나머지는 가안 (2~3학년 진행 학생 등)
 *
 * 모드에 따라 SYSTEM_PROMPT/buildUserPrompt가 톤을 전환한다.
 */
export type ActivitySummaryMode = "analysis" | "prospective" | "hybrid";

/** generateActivitySummary 액션의 입력 */
export interface ActivitySummaryInput {
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetGrades: number[];
  /** B8: 전체 시계열 모드 */
  mode: ActivitySummaryMode;
  recordDataByGrade: Record<
    number,
    {
      /** B8: 학년별 모드 — 학년 단위로 톤 전환 */
      gradeMode: ActivitySummaryMode;
      seteks: Array<{ subject_name: string; content: string; isDraft: boolean }>;
      personalSeteks: Array<{ title: string; content: string; isDraft: boolean }>;
      changche: Array<{ activity_type: string; content: string; isDraft: boolean }>;
      haengteuk: { content: string; isDraft: boolean } | null;
      readings: Array<{ book_title: string; book_author?: string }>;
    }
  >;
  storylines?: Array<{ title: string; keywords: string[] }>;
  /** Phase E2: 영역간 연결 프롬프트 섹션 */
  edgePromptSection?: string;
  /** Q3: 이전 학년 요약 (다학년 비교 성장 서술용) */
  previousSummaryText?: string;
  /** B8: 설계 산출물 (course_plans, guide_matching 등) — prospective/hybrid 학년 보강용 */
  designArtifactsSection?: string;
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
  /** Phase β G7: 학생 격자 컨텍스트 (탐구 레벨 + 메인 탐구 tier_plan) */
  gridContext?: import("./actions/cell-guide-grid-context").CellGuideGridContext;
  /**
   * 학생 정체성 프로필 카드 텍스트 (interestConsistency narrative + crossGradeThemes 포함).
   * P1-P3 역량 분석에서 사용하는 ctx.belief.profileCard 를 P4 가이드 생성 시에도 주입하여
   * 학생 식별성이 반영된 가이드 방향을 생성할 수 있도록 한다.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  studentProfileCard?: string;
  /**
   * 세특 서사 완성도(8단계) 섹션 텍스트.
   * buildNarrativeArcDiagnosisSection()이 생성한 마크다운 섹션을 전달.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  narrativeArcSection?: string;
  /**
   * β+1: MidPipeline Planner 메타 판정 섹션 (buildMidPlanGuideSection() 결과).
   * 컨설턴트의 우선순위 판단(focusHypothesis/concernFlags/recordPriorityOverride)을
   * 가이드 방향에 반영하기 위해 주입한다.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  midPlanSection?: string;
  /**
   * 격차 D (2026-04-26): 학종 3요소 통합 점수 섹션 (buildHakjongScoreSection() 결과).
   * 가이드가 약점 축(공동체 45점 등)을 우선 보강하는 방향으로 생성되도록 주입.
   * undefined/"" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  hakjongScoreSection?: string;
}

/** generateSetekGuide 액션의 출력 */
export interface SetekGuideResult {
  title: string;
  guides: import("@/lib/domains/student-record/types").SetekGuideItem[];
  overallDirection: string;
  /** prospective 모드에서 LLM 에 노출된 수강계획 과목 수. 완결성 가드용 (runner 에서 guides.length / requestedSubjectCount 비교). NEIS 모드는 미사용. */
  requestedSubjectCount?: number;
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
  /** Phase δ-6 (G11): 활성 메인 탐구 섹션. 학기별 missions 정합 기준. */
  mainExplorationSection?: string;
  /** C3(2026-04-16): Blueprint milestone 섹션. 학기별 로드맵이 Blueprint 수렴·마일스톤에 정합하도록 주입. */
  blueprintSection?: string;
  /** C3(2026-04-16): Gap Tracker bridge 섹션. 시급한 bridge 제안을 학기 활동으로 변환. */
  bridgeSection?: string;
  /** 격차 B: MidPlan focusHypothesis + concernFlags. buildMidPlanSynthesisSection() 결과. */
  midPlanSynthesisSection?: string;
  /** 격차 1 다학년 통합: buildMidPlanByGradeSection() 결과. */
  midPlanByGradeSection?: string;
  /** 격차 B: 학종 3요소 통합 점수 섹션. buildHakjongScoreSection() 결과. */
  hakjongScoreSection?: string;
  /** 격차 B: S5 합의 전략 요약 섹션. buildStrategySummarySection() 결과. */
  strategySummarySection?: string;
  /** Phase C A1: 직전 실행 미해결 격차 섹션 (previousRunOutputs 기반). 없으면 생략. */
  previousRunOutputsSection?: string;
  /** Phase C A2: 전 학년 반복 품질 패턴 섹션 (qualityPatterns 기반). 없으면 생략. */
  qualityPatternsSection?: string;
  /** Phase C A3: 이번 실행 학년 지배 교과 교차 테마 섹션 (buildGradeThemesSection() 결과). 없으면 생략. */
  gradeThemesSection?: string;
  /** Phase C A4: 세특 8단계 서사 완성도 섹션 (buildNarrativeArcDiagnosisSection() 결과). 없으면 생략. */
  narrativeArcSection?: string;
  /** Phase C A5: hyperedge(N-ary 수렴 테마) 요약 섹션. 없으면 생략. */
  hyperedgeSummarySection?: string;
  /** Phase C A6: 학생 정체성 프로필 카드 텍스트 (ctx.belief.profileCard). 없으면 생략. */
  profileCardSection?: string;
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
  /** Phase β G7: 학생 격자 컨텍스트 */
  gridContext?: import("./actions/cell-guide-grid-context").CellGuideGridContext;
  /**
   * 학생 정체성 프로필 카드 텍스트 (interestConsistency narrative + crossGradeThemes 포함).
   * P1-P3 역량 분석에서 사용하는 ctx.belief.profileCard 를 P5 가이드 생성 시에도 주입하여
   * 학생 식별성이 반영된 가이드 방향을 생성할 수 있도록 한다.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  studentProfileCard?: string;
  /**
   * 세특 서사 완성도(8단계) 섹션 텍스트.
   * buildNarrativeArcDiagnosisSection()이 생성한 마크다운 섹션을 전달.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  narrativeArcSection?: string;
  /**
   * β+1: MidPipeline Planner 메타 판정 섹션 (buildMidPlanGuideSection() 결과).
   * 컨설턴트의 우선순위 판단(focusHypothesis/concernFlags/recordPriorityOverride)을
   * 가이드 방향에 반영하기 위해 주입한다.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  midPlanSection?: string;
  /**
   * 격차 D (2026-04-26): 학종 3요소 통합 점수 섹션 (buildHakjongScoreSection() 결과).
   * 가이드가 약점 축(공동체 45점 등)을 우선 보강하는 방향으로 생성되도록 주입.
   * undefined/"" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  hakjongScoreSection?: string;
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
  /** Phase β G7: 학생 격자 컨텍스트 */
  gridContext?: import("./actions/cell-guide-grid-context").CellGuideGridContext;
  /**
   * 학생 정체성 프로필 카드 텍스트 (interestConsistency narrative + crossGradeThemes 포함).
   * P1-P3 역량 분석에서 사용하는 ctx.belief.profileCard 를 P6 가이드 생성 시에도 주입하여
   * 학생 식별성이 반영된 가이드 방향을 생성할 수 있도록 한다.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  studentProfileCard?: string;
  /**
   * 세특 서사 완성도(8단계) 섹션 텍스트.
   * buildNarrativeArcDiagnosisSection()이 생성한 마크다운 섹션을 전달.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  narrativeArcSection?: string;
  /**
   * β+1: MidPipeline Planner 메타 판정 섹션 (buildMidPlanGuideSection() 결과).
   * 컨설턴트의 우선순위 판단(focusHypothesis/concernFlags/recordPriorityOverride)을
   * 가이드 방향에 반영하기 위해 주입한다.
   * undefined 또는 "" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  midPlanSection?: string;
  /**
   * 격차 D (2026-04-26): 학종 3요소 통합 점수 섹션 (buildHakjongScoreSection() 결과).
   * 가이드가 약점 축(공동체 45점 등)을 우선 보강하는 방향으로 생성되도록 주입.
   * undefined/"" 이면 해당 섹션을 프롬프트에서 생략한다.
   */
  hakjongScoreSection?: string;
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

// ============================================
// Phase 2 Layer 3: Narrative Arc 8단계 서사 태깅
// setek-evaluation-framework Phase B 규칙 구조화
// ============================================

/** 8단계 서사 stage key — DB 컬럼과 1:1 매핑 */
export type NarrativeArcStage =
  | "curiosity"           // ①호기심
  | "topicSelection"      // ②주제선정
  | "inquiryContent"      // ③탐구내용
  | "references"          // ④참고문헌
  | "conclusion"          // ⑤결론
  | "teacherObservation"  // ⑥교사관찰
  | "growthNarrative"     // ⑦성장서사
  | "reinquiry";          // ⑧재탐구

/** 단일 레코드의 Narrative Arc 추출 입력 */
export interface NarrativeArcExtractionInput {
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  recordId: string;
  schoolYear: number;
  grade: number;
  /** 교과 세특만 제공 */
  subjectName?: string;
  /** 분석 대상 원문 (NEIS 또는 가안) */
  content: string;
  /** 진로역량 가중 평가 힌트 (있으면 재탐구·성장서사 판정 보조) */
  targetMajor?: string;
}

/** 단계별 평가 결과 */
export interface NarrativeArcStageResult {
  /** 해당 단계가 원문에서 식별되는가 */
  present: boolean;
  /** LLM 자체 확신도 0~1 */
  confidence: number;
  /** 원문 인용 또는 짧은 근거 (150자 이하). present=false일 때는 빈 문자열 */
  evidence: string;
}

/** Narrative Arc 추출 최종 결과 */
export interface NarrativeArcExtractionResult {
  curiosity: NarrativeArcStageResult;
  topicSelection: NarrativeArcStageResult;
  inquiryContent: NarrativeArcStageResult;
  references: NarrativeArcStageResult;
  conclusion: NarrativeArcStageResult;
  teacherObservation: NarrativeArcStageResult;
  growthNarrative: NarrativeArcStageResult;
  reinquiry: NarrativeArcStageResult;
  /** 0~8 (present=true 카운트) */
  stagesPresentCount: number;
  elapsedMs: number;
  /** 실제 호출된 모델 (fallback 시 변경 가능) */
  modelName?: string;
}
