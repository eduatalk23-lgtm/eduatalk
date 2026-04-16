// ============================================
// AI 생기부 분석 파이프라인 타입
// 3-Tier 구조: Grade Pipeline → Synthesis Pipeline (+ Legacy 단일 파이프라인)
//
// Grade Pipeline (학년별 7태스크×6Phase):
//   GP1: competency_setek → GP2: competency_changche → GP3: competency_haengteuk
//   GP4: setek_guide + slot_generation → GP5: changche_guide → GP6: haengteuk_guide
//
// Synthesis Pipeline (종합 10태스크×6Phase):
//   SP1: storyline → SP2: edge + guide_matching
//   SP3: diagnosis + course_rec → SP4: bypass
//   SP5: summary + strategy → SP6: interview + roadmap
//
// Legacy (PIPELINE_TASK_KEYS): 하위 호환용 단일 15태스크 파이프라인
// ============================================

import {
  PIPELINE_TASK_KEYS,
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
} from "./pipeline-config";

export type PipelineOverallStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";
export type PipelineTaskStatus = "pending" | "running" | "completed" | "failed";

export type GradePipelineTaskKey = (typeof GRADE_PIPELINE_TASK_KEYS)[number];
export type SynthesisPipelineTaskKey = (typeof SYNTHESIS_PIPELINE_TASK_KEYS)[number];
export type PastAnalyticsTaskKey = (typeof PAST_ANALYTICS_TASK_KEYS)[number];
export type BlueprintTaskKey = (typeof BLUEPRINT_TASK_KEYS)[number];
export type PipelineTaskKey = (typeof PIPELINE_TASK_KEYS)[number];

/** 파이프라인 유형 (2026-04-16 D): 5종. legacy는 단일 파이프라인 하위 호환. */
export type PipelineType = "grade" | "synthesis" | "past_analytics" | "blueprint" | "legacy";

export interface PipelineStatus {
  id: string;
  studentId: string;
  status: PipelineOverallStatus;
  /** prospective = 기록 없는 신입생(수강계획 기반), analysis = 기록 있는 학생(기존) */
  mode?: "analysis" | "prospective" | null;
  tasks: Record<PipelineTaskKey, PipelineTaskStatus>;
  taskPreviews: Record<string, string>;
  taskResults: PipelineTaskResults;
  errorDetails: Record<string, string> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  contentHash?: string | null;
}

// ============================================
// 파이프라인 내부 타입
// ============================================

/** taskResults 타입 (JSON-serializable) */
export type PipelineTaskResults = Record<string, unknown>;

// ============================================
// 태스크 결과 타입 맵 (typed accessor용)
// ============================================

/**
 * 각 태스크 캐시 키의 결과 타입 정의.
 * PipelineTaskResults는 하위 호환을 위해 Record<string, unknown>으로 유지하고,
 * 이 맵을 통해 getTaskResult() / setTaskResult() 헬퍼에서 타입 안전성을 제공한다.
 *
 * 타입이 완전히 확정되지 않은 태스크는 Record<string, unknown>으로 선언 (점진적 강화).
 */
export interface PipelineTaskResultMap {
  // ── Grade Pipeline ──────────────────────────
  /** P1: 세특 역량 분석 결과 (elapsedMs는 executor가 병합) */
  competency_setek: { allCached: boolean; elapsedMs?: number; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number } };
  /** P2: 창체 역량 분석 결과 */
  competency_changche: { allCached: boolean; elapsedMs?: number; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number } };
  /** P3: 행특 역량 분석 결과 */
  competency_haengteuk: { allCached: boolean; elapsedMs?: number; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number } };
  /** P3.5: 과목 교차 테마 추출 (dominantThemeIds + 전체 themes 영속화, S3에서 소비) */
  cross_subject_theme_extraction: {
    themeCount: number;
    crossSubjectPatternCount: number;
    dominantThemeIds: string[];
    themes?: import("../llm/types").GradeTheme[];
    truncationWarning?: boolean;
    elapsedMs?: number;
  };
  /** P4-a: 세특 방향 가이드 */
  setek_guide: { cached?: boolean; elapsedMs?: number };
  /** P4-b: 슬롯 생성 (string preview만 반환 → result는 elapsedMs만) */
  slot_generation: { elapsedMs?: number };
  /** P5: 창체 방향 가이드 */
  changche_guide: { cached?: boolean; elapsedMs?: number };
  /** P6: 행특 방향 가이드 */
  haengteuk_guide: { cached?: boolean; elapsedMs?: number };
  /** P7: 설계 모드 가안 생성 (string preview만 반환) */
  draft_generation: { elapsedMs?: number };
  /** P8: 설계 모드 가안 분석 (string preview만 반환) */
  draft_analysis: { elapsedMs?: number };

  // ── Synthesis Pipeline ───────────────────────
  /** S1: 스토리라인 감지 */
  storyline_generation: {
    storylineCount: number;
    connectionCount: number;
    coverageWarnings?: DataCoverageWarning[];
    elapsedMs?: number;
  };
  /** S2-a: 엣지 연결 그래프 */
  edge_computation: {
    totalEdges: number;
    nodeCount: number;
    elapsedMs?: number;
  };
  /** S2-a': Layer 2 N-ary 수렴 엣지 (승격: 트랙 D, task_key 편입) */
  hyperedge_computation: {
    computedHyperedges: number;
    filteredBySize: number;
    filteredByConfidence: number;
    filteredByCompetency: number;
    pairsExplored: number;
    themeLabels: string[];
    mergedByJaccard?: number;
    droppedByRanking?: number;
    filteredByShallow?: number;
    elapsedMs?: number;
  };
  /** S2-a'': Layer 3 레코드별 8단계 서사 태깅 (승격+청크: 트랙 D) */
  narrative_arc_extraction: {
    total: number;
    succeeded: number;
    failed: number;
    skippedAlreadyAnalyzed: number;
    skippedShortContent: number;
    elapsedMs?: number;
  };
  /** S2-c: 행특 ↔ 탐구 가이드 링크 (승격: 트랙 D, string preview만 반환 → elapsedMs만) */
  haengteuk_linking: { elapsedMs?: number };
  /** S3-a: AI 종합 진단 */
  ai_diagnosis: {
    overallGrade: string;
    weaknessCount: number;
    improvementCount: number;
    coverageWarnings?: DataCoverageWarning[];
    _timeSeriesAnalysis?: import("@/lib/domains/record-analysis/eval/timeseries-analyzer").TimeSeriesAnalysis;
    elapsedMs?: number;
  };
  /** S3-b: 수강 추천 (string preview만 반환) */
  course_recommendation: { elapsedMs?: number };
  /** S2-b: 가이드 매칭 (string preview만 반환) */
  guide_matching: { elapsedMs?: number };
  /** S4: 우회학과 분석 (string preview만 반환) */
  bypass_analysis: { elapsedMs?: number };
  /** S5-a: 활동 요약서 (string preview만 반환) */
  activity_summary: { elapsedMs?: number };
  /** S5-b: 보완전략 자동 제안 */
  ai_strategy: {
    savedCount: number;
    _universityMatch?: import("@/lib/domains/record-analysis/eval/university-profile-matcher").UniversityMatchAnalysis;
    elapsedMs?: number;
  };
  /** S6-a: 면접 예상 질문 (string preview만 반환) */
  interview_generation: { elapsedMs?: number };
  /** S6-b: 학기별 로드맵 */
  roadmap_generation: { mode: string; itemCount: number; elapsedMs?: number };

  // ── Blueprint-Axis (B1: Blueprint pipeline, S3.5: Gap Tracker) ──
  /** B1 (blueprint pipeline): 진로→3년 수렴 설계 */
  blueprint_generation: { convergenceCount: number; milestoneGrades: number[]; growthTargetCount: number; elapsedMs?: number };
  /** S3.5: Gap Tracker — blueprint vs analysis 정합성 */
  gap_tracking: { coverage: number; coherenceScore: number; bridgeCount: number; driftCount: number; feasibleGapCount: number; elapsedMs?: number };

  // ── Past Analytics Pipeline (4축×3층 A층, 2026-04-16 D) ──
  /** A1: NEIS 기반 과거 서사 (scope='past' 스토리라인 영속화) */
  past_storyline_generation: { storylineCount: number; connectionCount: number; elapsedMs?: number };
  /** A2: 현상 진단 (scope='past' 진단 영속화) */
  past_diagnosis: { overallGrade: string; weaknessCount: number; schoolYears: number[]; elapsedMs?: number };
  /** A3: 즉시 행동 권고 (scope='past' 전략 영속화) */
  past_strategy: { savedCount: number; elapsedMs?: number };

  // ── Internal (Executive Summary + 4축 진단 + Blueprint) ──
  /** Synthesis Phase 6 완료 후 자동 생성되는 Executive Summary */
  _executiveSummary: import("@/lib/domains/record-analysis/eval/executive-summary").ExecutiveSummary;
  /** Synthesis Phase 6 완료 후 자동 생성되는 4축 합격 진단 프로필 */
  _fourAxisDiagnosis: import("@/lib/domains/admission/prediction/profile-diagnosis").FourAxisDiagnosis;
  /** Phase δ-3: 5축 합격 진단(4축 + 메인 탐구 정합성). mainInquiryAlignment=null 가능. */
  _fiveAxisDiagnosis: import("@/lib/domains/admission/prediction/profile-diagnosis").FiveAxisDiagnosis;
  /** S1.5: Blueprint Phase LLM 산출물 전체 */
  _blueprintPhase: import("@/lib/domains/record-analysis/blueprint/types").BlueprintPhaseOutput;
  /** S3.5: Gap Tracker 산출물 전체 */
  _gapTracker: import("@/lib/domains/record-analysis/blueprint/types").GapTrackerOutput;
  /** Journey Model 조합 스냅샷 (Blueprint + Analysis + Gap 통합 뷰) */
  _journeyModel: import("@/lib/domains/record-analysis/blueprint/types").StudentJourneyModel;
}

// ============================================
// NEIS 기반 레코드 해소 타입 (Step 1: pipeline-neis-driven-redesign)
// ============================================

/**
 * 단일 레코드의 NEIS 유무 판정 결과.
 * hasNeis = !!imported_content?.trim()
 * effectiveContent = NEIS 있으면 imported_content, 없으면 content(가안)
 */
export interface ResolvedRecord {
  id: string;
  grade: number;
  semester?: number;
  subjectId?: string;
  activityType?: string;      // changche only
  hasNeis: boolean;
  effectiveContent: string;
  subjectName?: string;
}

/** 학년별 해소 결과 */
export interface ResolvedRecordsByGrade {
  [grade: number]: {
    seteks: ResolvedRecord[];
    changche: ResolvedRecord[];
    haengteuk: ResolvedRecord | null;
    /** 해당 학년에 세특/창체/행특 중 하나라도 NEIS가 있는지 */
    hasAnyNeis: boolean;
  };
}

// ============================================
// 역량 분석 맥락 타입 (Phase 1-3 → Phase 4-6 전달)
// ============================================

/**
 * 단일 레코드의 역량 분석 맥락.
 * Grade Phase 1-3(역량 분석) 완료 후 수집하여 Phase 4-6(가이드 생성)에 전달.
 */
export interface RecordAnalysisContext {
  recordId: string;
  recordType: "setek" | "changche" | "haengteuk";
  subjectName?: string;
  /** 감지된 품질 문제 패턴 (예: "P1_나열식", "F10_성장부재") */
  issues: string[];
  /** 품질 개선 피드백 (1-2문장) */
  feedback: string;
  /** 전체 품질 점수 (0-100) */
  overallScore: number;
}

/**
 * 역량 등급 항목의 분석 맥락.
 * 낮은 등급(B- 이하) 항목의 reasoning을 가이드 프롬프트에 주입할 때 사용.
 */
export interface CompetencyAnalysisContext {
  item: string;
  grade: string;
  reasoning: string | null;
  /** 루브릭 질문별 평가 (B- 이하 항목만) */
  rubricScores?: Array<{
    questionIndex: number;
    grade: string;
    reasoning: string;
  }>;
}

/**
 * 학년별 역량 분석 맥락 집합.
 * PipelineContext.analysisContext에 저장.
 */
export interface GradeAnalysisContext {
  /** 학년 번호 (1/2/3) */
  grade: number;
  /** 품질 이슈가 있는 레코드 목록 (issues가 빈 배열인 레코드는 제외) */
  qualityIssues: RecordAnalysisContext[];
  /** B- 이하 역량 등급 항목 */
  weakCompetencies: CompetencyAnalysisContext[];
}

/** 전체 학년에 걸친 역량 분석 맥락 (학년 번호 → 맥락) */
export type AnalysisContextByGrade = Record<number, GradeAnalysisContext>;

/**
 * Layer 0: 전 학년 학생 프로필 카드 (Cross-grade student snapshot).
 * P1-P3 역량 분석 시 모든 셀 프롬프트에 주입되는 글로벌 맥락.
 * 이전 학년(prior grades) 데이터만 집계 — 현재 targetGrade는 제외.
 * 1학년(prior 데이터 없음)은 undefined.
 */
export interface StudentProfileCard {
  /** 집계 대상 이전 학년도 목록 (예: [2024, 2025]) */
  priorSchoolYears: number[];
  /** 이전 학년 누적 평균 등급 라벨 (A+=6 ~ C=1 환산 평균 → 역변환) */
  overallAverageGrade: string;
  /** 지속 강점: 이전 학년에서 A-/A+ 등급 역량 (최대 5개) */
  persistentStrengths: Array<{ competencyItem: string; bestGrade: string; years: number[] }>;
  /** 지속 약점: 2학년 이상에서 B-/C 등급으로 등장한 역량 (최대 5개) */
  persistentWeaknesses: Array<{ competencyItem: string; worstGrade: string; years: number[] }>;
  /** 반복 품질 이슈: content_quality.issues 중 빈도 top 3 (count ≥ 2만) */
  recurringQualityIssues: Array<{ code: string; count: number }>;
  /** 이전 학년 평균 품질 점수 (overall_score 평균, 소수 1자리) */
  averageQualityScore: number | null;
  // ── H2 (L3-B) Narrative 서사 벡터 ──
  /**
   * 진로역량(career_*) 등급의 학년별 평균 추이.
   * byYear 길이 < 2이면 trend는 'stable' 고정. 데이터 부족 시 undefined.
   */
  careerTrajectory?: {
    byYear: Array<{ year: number; averageNumericGrade: number }>;
    trend: "rising" | "stable" | "falling";
    /** byYear의 마지막 - 첫 값 (numeric 1~6 스케일) */
    growthDelta: number;
  };
  /**
   * content_quality.depth 축(0~5)의 학년별 평균.
   * byYear 길이 < 2이면 undefined 반환 (의미 있는 추이가 성립하지 않음).
   */
  depthProgression?: {
    byYear: Array<{ year: number; averageDepth: number }>;
    trend: "rising" | "stable" | "falling";
  };
  /**
   * H1 cross-subject theme 중 이전 학년 dominant 테마.
   * Grade Pipeline task_results에서 복원. 1건 이상일 때만 세팅.
   */
  crossGradeThemes?: Array<{
    id: string;
    label: string;
    years: number[];
    affectedSubjects: string[];
  }>;
  /**
   * H2 LLM 서사: 이전 학년 관심사·궤적의 일관성에 대한 2~3문장 평가.
   * 데이터가 부족하거나 LLM 호출 실패 시 undefined.
   */
  interestConsistency?: {
    /** 한국어 2~3문장 서사. */
    narrative: string;
    /** 서사가 근거로 삼은 crossGradeThemes id (없으면 빈 배열). */
    sourceThemeIds: string[];
    /** LLM 자체 신뢰도 0~1. */
    confidence: number;
  };
}

/**
 * Phase 분할 실행을 위한 파이프라인 실행 컨텍스트.
 *
 * 필드 그룹:
 * - **Core** (9필드): 모든 Phase 공유 — pipelineId~errors
 * - **공유 데이터** (3필드): Grade/Synthesis 양쪽 사용 — studentGrade, snapshot, coursePlanData
 * - **Grade Pipeline** (10필드): targetGrade~cachedReport
 * - **Synthesis Pipeline** (2필드): unifiedInput, gradePipelineIds
 *
 * Phase별 narrowed 타입은 아래 `GradeAnalysisCompleteCtx`, `SynthesisCtx` 등 참조.
 */
export interface PipelineContext {
  // ── Core (모든 Phase 공유, 9필드) ─────────────────────
  pipelineId: string;
  studentId: string;
  tenantId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/database.types").Database>;
  /** 파이프라인 유형 (2026-04-16 D): grade / synthesis / past_analytics / blueprint / legacy. */
  pipelineType: PipelineType;
  /** 태스크 상태 (매 태스크 완료 시 DB 저장) */
  tasks: Record<string, PipelineTaskStatus>;
  previews: Record<string, string>;
  results: PipelineTaskResults;
  errors: Record<string, string>;

  // ── 공유 데이터 (Grade + Synthesis 양쪽 사용) ─────────
  studentGrade: number;
  snapshot: Record<string, unknown> | null;
  coursePlanData?: import("@/lib/domains/student-record/types").CoursePlanTabData | null;
  /** NEIS 기반: 분석 경로 대상 학년 (resolveRecords 이후 세팅) */
  neisGrades?: number[];

  // ── Grade Pipeline 전용 ───────────────────────────────
  /** 처리 대상 학년 (1/2/3) */
  targetGrade?: number;
  /** 레코드 캐시 (Phase 간 DB 재조회 방지) */
  cachedSeteks?: CachedSetek[] | null;
  cachedChangche?: CachedChangche[] | null;
  cachedHaengteuk?: CachedHaengteuk[] | null;
  /** NEIS 기반 해소 데이터 (Step 1 이후 항상 세팅) */
  resolvedRecords?: ResolvedRecordsByGrade;
  consultingGrades?: number[];
  /**
   * Phase 1-3(역량 분석) 완료 후 수집된 분석 맥락.
   * Phase 4-6(가이드 생성)에서 직접 참조하여 약점/이슈 기반 가이드 작성.
   * ctx.results(untyped)와 별도로 typed 필드로 관리.
   */
  analysisContext?: AnalysisContextByGrade;
  /** Grade Pipeline의 모드: analysis(NEIS) 또는 design(수강계획 기반 설계) */
  gradeMode?: "analysis" | "design";
  /** 레벨링 결과 캐시 (P7에서 1회 산출, P8/Synthesis에서 재사용) */
  leveling?: import("@/lib/domains/student-record/leveling/types").LevelingResult;
  /** C3: fetchReportData 결과 캐시 — Phase 4-6 간 공유하여 중복 호출 방지 */
  cachedReport?: import("@/lib/domains/student-record/actions/report").ReportData;
  /**
   * C4: Layer 0 학생 프로필 카드 (렌더된 prompt 섹션 문자열).
   * - `undefined` = 미빌드
   * - `""` = 빌드 시도했으나 데이터 없음 (1학년/데이터 공란)
   * - `"## 학생 프로필 카드..."` = 빌드 완료
   * P1-P3에서 1회만 빌드, 이후 재사용. 세 상태를 구분해 6회 호출 간 중복 DB 조회 방지.
   */
  profileCard?: string;
  /**
   * Blueprint 설계 산출물 캐시 (2026-04-16 D 결정 5).
   * Grade Pipeline 설계 모드(P4~P7) 프롬프트에 주입. Phase 4 진입 시 DB 조회 후 캐시.
   * Past Analytics는 접근 불필요(역참조 불허).
   */
  blueprint?: import("../blueprint/types").BlueprintPhaseOutput;

  // ── Synthesis Pipeline 전용 ───────────────────────────
  /** 의존하는 grade 파이프라인 ID 목록 (완료 판정 등에 사용) */
  gradePipelineIds?: string[];
  /** 통합 학년 입력 (buildUnifiedGradeInput으로 1회 구성) */
  unifiedInput?: import("./pipeline-unified-input").UnifiedGradeInput;
  /** S3에서 산출한 전 학년 반복 품질 패턴 (S5 전략 생성에 전달) */
  qualityPatterns?: Array<{ pattern: string; count: number; subjects: string[] }>;
  /**
   * H1 / L3-A: 학년 단위 과목 교차 테마 추출 결과 (Grade Pipeline 한정).
   * Phase 4 진입 직전 1회 산출 → setek/changche/haengteuk 가이드 프롬프트에 주입.
   * 실패/스킵 시 undefined (가이드는 themes 없이 동작 — graceful degradation).
   */
  gradeThemes?: import("../llm/types").GradeThemeExtractionResult;
  /** M4: 가이드 배정 컨텍스트 캐시 (Phase 4-6 + Synthesis S5 간 DB 재조회 방지) */
  cachedGuideContexts?: Partial<Record<"guide" | "summary" | "strategy", string>>;
}

/** Core 9필드 — 모든 Phase에서 공유하는 인프라 필드 */
export type CorePipelineFields = Pick<
  PipelineContext,
  "pipelineId" | "studentId" | "tenantId" | "supabase" | "pipelineType" | "tasks" | "previews" | "results" | "errors"
>;

// ============================================
// Phase별 narrowed 타입 — 특정 Phase 이후 보장되는 필드
// 기존 PipelineContext를 깨지 않고 소비자 측에서 타입 안전성 확보
// ============================================

/** Grade P1-P3 완료 후: resolvedRecords + cachedRecords + analysisContext 보장 */
export interface GradeAnalysisCompleteCtx extends PipelineContext {
  pipelineType: "grade";
  targetGrade: number;
  resolvedRecords: NonNullable<PipelineContext["resolvedRecords"]>;
  analysisContext: NonNullable<PipelineContext["analysisContext"]>;
}

/** Grade P4-P6 완료 후: 가이드 생성 컨텍스트 보장 */
export interface GradeGuideCompleteCtx extends GradeAnalysisCompleteCtx {
  gradeMode: "analysis" | "design";
}

/** Grade P7-P8 (설계 모드): leveling 결과 보장 */
export interface GradeDesignCompleteCtx extends GradeGuideCompleteCtx {
  gradeMode: "design";
  leveling: NonNullable<PipelineContext["leveling"]>;
}

/** Synthesis 파이프라인: unifiedInput 보장 */
export interface SynthesisCtx extends PipelineContext {
  pipelineType: "synthesis";
  unifiedInput: NonNullable<PipelineContext["unifiedInput"]>;
  gradePipelineIds: string[];
}

/** Phase 전환 시 필수 필드 존재를 확인하는 어설션 헬퍼 */
export function assertGradeCtx(ctx: PipelineContext): asserts ctx is GradeAnalysisCompleteCtx {
  if (ctx.pipelineType !== "grade") throw new Error(`assertGradeCtx: expected grade pipeline, got ${ctx.pipelineType}`);
  if (ctx.targetGrade == null) throw new Error("assertGradeCtx: targetGrade is required");
  if (!ctx.resolvedRecords) throw new Error("assertGradeCtx: resolvedRecords not populated");
}

export function assertSynthesisCtx(ctx: PipelineContext): asserts ctx is SynthesisCtx {
  if (ctx.pipelineType !== "synthesis") throw new Error(`assertSynthesisCtx: expected synthesis pipeline, got ${ctx.pipelineType}`);
  if (!ctx.unifiedInput) throw new Error("assertSynthesisCtx: unifiedInput not populated (call buildUnifiedGradeInput first)");
}

// ============================================
// 데이터 커버리지 경고 (Synthesis 태스크 출력에 포함)
// ============================================

export interface DataCoverageWarning {
  /** 경고를 생산한 Synthesis 태스크 */
  taskKey: string;
  /** 경고 코드 */
  code: "partial_analysis" | "no_analysis" | "design_only_grades";
  /** 사용자 표시용 메시지 */
  message: string;
  /** 영향받는 학년 */
  affectedGrades: number[];
  /** UI 표시 심각도 */
  severity: "info" | "warning";
}

/** 이어서 실행 시 복원할 상태 */
export interface ExistingPipelineState {
  tasks: Record<string, PipelineTaskStatus>;
  previews: Record<string, string>;
  results: Record<string, unknown>;
  errors: Record<string, string>;
}

/** 태스크 러너 반환 타입 */
export type TaskRunnerOutput = string | { preview: string; result: unknown };

/** Supabase join 결과: student_internal_scores + subject */
export interface ScoreRowWithSubject {
  subject: { name: string } | null;
  rank_grade: number | null;
  grade: number;
  semester: number;
}

/** 캐시된 세특 쿼리 결과 */
export interface CachedSetek {
  id: string;
  content: string;
  imported_content: string | null;
  confirmed_content?: string | null;
  ai_draft_content?: string | null;
  grade: number;
  subject: { name: string } | null;
}

/** 캐시된 창체 쿼리 결과 */
export interface CachedChangche {
  id: string;
  content: string;
  imported_content: string | null;
  confirmed_content?: string | null;
  ai_draft_content?: string | null;
  grade: number;
  activity_type: string | null;
}

/** 캐시된 행특 쿼리 결과 */
export interface CachedHaengteuk {
  id: string;
  content: string;
  imported_content: string | null;
  confirmed_content?: string | null;
  ai_draft_content?: string | null;
  grade: number;
}

/** 개설 과목 쿼리 결과 */
export interface OfferedSubjectRow {
  subject: { name: string } | null;
}

// ============================================
// Pipeline Snapshot (P2-3: 재실행 히스토리)
// ============================================

export interface PipelineSnapshot {
  id: string;
  pipeline_id: string;
  snapshot: PipelineTaskResults;
  created_at: string;
}

// ── Backward compatibility re-exports ──
export {
  PIPELINE_TASK_KEYS,
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
  GRADE_TASK_DEPENDENTS,
  GRADE_TASK_PREREQUISITES,
  SYNTHESIS_TASK_DEPENDENTS,
  SYNTHESIS_TASK_PREREQUISITES,
  PAST_ANALYTICS_TASK_DEPENDENTS,
  PAST_ANALYTICS_TASK_PREREQUISITES,
  GRADE_PIPELINE_TASK_LABELS,
  GRADE_PIPELINE_TASK_TIMEOUTS,
  PAST_ANALYTICS_TASK_LABELS,
  PAST_ANALYTICS_TASK_TIMEOUTS,
  PAST_ANALYTICS_PHASE_TASKS,
  BLUEPRINT_TASK_LABELS,
  BLUEPRINT_TASK_TIMEOUTS,
  BLUEPRINT_PHASE_TASKS,
  PIPELINE_TASK_LABELS,
  PIPELINE_TASK_TIMEOUTS,
  PIPELINE_TASK_DEPENDENTS,
  GRADE_PHASE_TASKS,
  SYNTHESIS_PHASE_TASKS,
  PIPELINE_RERUN_CASCADE,
  derivePipelineCascadeKey,
} from "./pipeline-config";

export type { PipelineCascadeKey } from "./pipeline-config";

export {
  getTaskResult,
  setTaskResult,
  computeCascadeResetKeys,
} from "./pipeline-helpers";
