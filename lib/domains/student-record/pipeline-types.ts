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

export type PipelineOverallStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";
export type PipelineTaskStatus = "pending" | "running" | "completed" | "failed";

export const PIPELINE_TASK_KEYS = [
  "competency_analysis",     // 1st: 역량 태그 + 등급 생성
  "storyline_generation",    // 2nd: 기록 분석 → 스토리라인 감지 (진단보다 먼저)
  "edge_computation",        // 3rd: 태그+스토리라인 → 7종 엣지 영속화
  "ai_diagnosis",            // 4th: 역량+엣지 → 종합진단(강점/약점)
  "course_recommendation",   // 5th: 수강 추천 (독립)
  "slot_generation",         // NEIS 없는 학년의 세특/창체/행특 슬롯 자동 생성 (Grade GP4에서도 실행)
  "guide_matching",          // 6th: 가이드 배정 (독립)
  "bypass_analysis",         // 7th: 우회학과 분석 (독립, Phase 2)
  "setek_guide",             // 8th: 진단+엣지 → 세특 방향
  "changche_guide",          // 9th: 세특방향 → 창체 방향 (Phase 3b)
  "haengteuk_guide",         // 10th: 창체방향 → 행특 방향 (Phase 3c)
  "activity_summary",        // 11th: 스토리라인+엣지 → 활동 요약서
  "ai_strategy",             // 12th: 진단 약점+부족역량 → 보완전략 자동 제안
  "interview_generation",    // 13th: 기록+진단 → 면접 예상 질문 생성
  "roadmap_generation",      // 14th: 진단+스토리라인+세특/창체/행특방향 → 학기별 로드맵
] as const;

// ============================================
// 학년 단위 파이프라인 태스크 (Grade Pipeline — 학년별 7개)
// GradePhase 1: competency_setek
// GradePhase 2: competency_changche
// GradePhase 3: competency_haengteuk
// GradePhase 4: setek_guide + slot_generation (병렬)
// GradePhase 5: changche_guide
// GradePhase 6: haengteuk_guide
// GradePhase 7: draft_generation (설계 모드 전용)
// GradePhase 8: draft_analysis (설계 모드 전용)
// ============================================

export const GRADE_PIPELINE_TASK_KEYS = [
  "competency_setek",
  "competency_changche",
  "competency_haengteuk",
  "setek_guide",
  "slot_generation",
  "changche_guide",
  "haengteuk_guide",
  "draft_generation",
  "draft_analysis",
] as const;

export type GradePipelineTaskKey = (typeof GRADE_PIPELINE_TASK_KEYS)[number];

// ============================================
// 종합 파이프라인 태스크 (Synthesis Pipeline — 종합 10개)
// ============================================

export const SYNTHESIS_PIPELINE_TASK_KEYS = [
  "storyline_generation",
  "edge_computation",
  "ai_diagnosis",
  "course_recommendation",
  "guide_matching",
  "bypass_analysis",
  "activity_summary",
  "ai_strategy",
  "interview_generation",
  "roadmap_generation",
] as const;

export type SynthesisPipelineTaskKey = (typeof SYNTHESIS_PIPELINE_TASK_KEYS)[number];

// ============================================
// 학년 내 의존 관계 (Grade Pipeline 내부)
// ============================================

/**
 * Grade 파이프라인 내 상류 태스크 → 하류 의존 태스크 매핑 (전이적 폐쇄).
 * - competency_setek 완료 후 setek_guide, changche_guide, haengteuk_guide 실행 가능
 * - competency_changche 완료 후 changche_guide, haengteuk_guide 실행 가능
 * - competency_haengteuk 완료 후 haengteuk_guide 실행 가능
 * - setek_guide 완료 후 changche_guide, haengteuk_guide 실행 가능
 * - changche_guide 완료 후 haengteuk_guide 실행 가능
 */
export const GRADE_TASK_DEPENDENTS: Partial<Record<GradePipelineTaskKey, GradePipelineTaskKey[]>> = {
  competency_setek: ["slot_generation", "setek_guide", "changche_guide", "haengteuk_guide"],
  competency_changche: ["slot_generation", "changche_guide", "haengteuk_guide"],
  competency_haengteuk: ["slot_generation", "haengteuk_guide"],
  setek_guide: ["changche_guide", "haengteuk_guide", "draft_generation"],
  changche_guide: ["haengteuk_guide", "draft_generation"],
  haengteuk_guide: ["draft_generation", "draft_analysis"],
  draft_generation: ["draft_analysis"],
};

// ============================================
// Grade 선행 필수 태스크 (GRADE_TASK_DEPENDENTS의 역)
// ============================================

/**
 * 태스크별 선행 필수 태스크 목록.
 * 선행 태스크 중 하나라도 failed이면 해당 태스크를 자동 스킵한다.
 */
export const GRADE_TASK_PREREQUISITES: Partial<Record<GradePipelineTaskKey, GradePipelineTaskKey[]>> = {
  slot_generation: ["competency_setek", "competency_changche", "competency_haengteuk"],
  setek_guide: ["competency_setek"],
  changche_guide: ["competency_setek", "competency_changche", "setek_guide"],
  haengteuk_guide: ["competency_setek", "competency_changche", "competency_haengteuk", "setek_guide", "changche_guide"],
  draft_generation: ["setek_guide", "changche_guide", "haengteuk_guide"],
  draft_analysis: ["haengteuk_guide", "draft_generation"],
};

// ============================================
// Synthesis 의존 관계 (Synthesis Pipeline 내부)
// ============================================

/**
 * Synthesis 파이프라인 내 상류 태스크 → 하류 의존 태스크 매핑 (전이적 폐쇄).
 * 기존 PIPELINE_TASK_DEPENDENTS에서 synthesis 태스크만 추출.
 */
export const SYNTHESIS_TASK_DEPENDENTS: Partial<Record<SynthesisPipelineTaskKey, SynthesisPipelineTaskKey[]>> = {
  storyline_generation: ["edge_computation", "ai_diagnosis", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  edge_computation: ["ai_diagnosis", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  guide_matching: ["activity_summary", "roadmap_generation"],
  ai_diagnosis: ["ai_strategy", "interview_generation", "roadmap_generation"],
};

export type PipelineTaskKey = (typeof PIPELINE_TASK_KEYS)[number];

// ============================================
// Grade Pipeline 전용 레이블/타임아웃
// ============================================

export const GRADE_PIPELINE_TASK_LABELS: Record<GradePipelineTaskKey, string> = {
  competency_setek: "세특 역량 분석",
  competency_changche: "창체 역량 분석",
  competency_haengteuk: "행특 역량 분석",
  setek_guide: "세특 방향",
  slot_generation: "슬롯 생성",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
  draft_generation: "가안 생성",
  draft_analysis: "가안 분석",
};

/** Grade Pipeline 태스크별 타임아웃 (ms) */
export const GRADE_PIPELINE_TASK_TIMEOUTS: Record<GradePipelineTaskKey, number> = {
  competency_setek: 280_000,   // 세특이 가장 오래 걸림 (Vercel 5분 제한 내 여유)
  competency_changche: 120_000,
  competency_haengteuk: 120_000,
  setek_guide: 120_000,
  slot_generation: 30_000,
  changche_guide: 120_000,
  haengteuk_guide: 120_000,
  draft_generation: 240_000,  // 세특+창체+행특 가안 순차 생성
  draft_analysis: 280_000,   // 가안 역량 분석 (세특이 가장 오래)
};

export const PIPELINE_TASK_LABELS: Record<PipelineTaskKey, string> = {
  competency_analysis: "역량 분석",
  storyline_generation: "스토리라인 감지",
  edge_computation: "연결 분석",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  slot_generation: "슬롯 생성",
  guide_matching: "가이드 매칭",
  bypass_analysis: "우회학과 분석",
  setek_guide: "세특 방향",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
  activity_summary: "활동 요약서",
  ai_strategy: "보완전략 제안",
  interview_generation: "면접 질문 생성",
  roadmap_generation: "로드맵 생성",
};

/** 태스크별 타임아웃 (ms). 초과 시 failed 전환. */
export const PIPELINE_TASK_TIMEOUTS: Record<PipelineTaskKey, number> = {
  competency_analysis: 280_000,   // 4분 40초 (다건 배치 — Vercel 5분 제한 내 여유)
  storyline_generation: 120_000,
  edge_computation: 30_000,       // CPU 기반 (5-10s)
  ai_diagnosis: 120_000,          // 2분 (실제 20-30s, 여유 포함)
  course_recommendation: 120_000,
  slot_generation: 30_000,        // 30초 (DB upsert 위주)
  guide_matching: 60_000,         // DB 조회 위주
  bypass_analysis: 120_000,
  setek_guide: 120_000,
  changche_guide: 120_000,
  haengteuk_guide: 120_000,
  activity_summary: 120_000,
  ai_strategy: 120_000,
  interview_generation: 120_000,
  roadmap_generation: 120_000,
};

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
  competency_setek: { allCached: boolean; elapsedMs?: number };
  /** P2: 창체 역량 분석 결과 */
  competency_changche: { allCached: boolean; elapsedMs?: number };
  /** P3: 행특 역량 분석 결과 */
  competency_haengteuk: { allCached: boolean; elapsedMs?: number };
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
  edge_computation: { totalEdges: number; nodeCount: number; elapsedMs?: number };
  /** S3-a: AI 종합 진단 */
  ai_diagnosis: {
    overallGrade: string;
    weaknessCount: number;
    improvementCount: number;
    coverageWarnings?: DataCoverageWarning[];
    _timeSeriesAnalysis?: import("./eval/timeseries-analyzer").TimeSeriesAnalysis;
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
    _universityMatch?: import("./eval/university-profile-matcher").UniversityMatchAnalysis;
    elapsedMs?: number;
  };
  /** S6-a: 면접 예상 질문 (string preview만 반환) */
  interview_generation: { elapsedMs?: number };
  /** S6-b: 학기별 로드맵 */
  roadmap_generation: { mode: string; itemCount: number; elapsedMs?: number };

  // ── Internal (Executive Summary + 4축 진단) ──
  /** Synthesis Phase 6 완료 후 자동 생성되는 Executive Summary */
  _executiveSummary: import("./eval/executive-summary").ExecutiveSummary;
  /** Synthesis Phase 6 완료 후 자동 생성되는 4축 합격 진단 프로필 */
  _fourAxisDiagnosis: import("@/lib/domains/admission/prediction/profile-diagnosis").FourAxisDiagnosis;
}

/**
 * 타입 안전한 ctx.results 읽기 헬퍼.
 * `as` 캐스트를 이 함수 1곳으로 집약한다.
 *
 * @example
 *   const diag = getTaskResult(ctx.results, "ai_diagnosis");
 *   diag?.overallGrade  // string | undefined
 */
export function getTaskResult<K extends keyof PipelineTaskResultMap>(
  results: PipelineTaskResults,
  key: K,
): PipelineTaskResultMap[K] | undefined {
  const raw = results[key];
  if (raw == null) return undefined;
  return raw as PipelineTaskResultMap[K];
}

/**
 * 타입 안전한 ctx.results 쓰기 헬퍼.
 * `as` 캐스트를 이 함수 1곳으로 집약한다.
 *
 * @example
 *   setTaskResult(ctx.results, "ai_diagnosis", { overallGrade: "A", weaknessCount: 2, improvementCount: 3 });
 */
export function setTaskResult<K extends keyof PipelineTaskResultMap>(
  results: PipelineTaskResults,
  key: K,
  value: PipelineTaskResultMap[K],
): void {
  results[key] = value;
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

/** Phase 분할 실행을 위한 파이프라인 실행 컨텍스트 */
export interface PipelineContext {
  pipelineId: string;
  studentId: string;
  tenantId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/database.types").Database>;
  studentGrade: number;
  snapshot: Record<string, unknown> | null;
  // 태스크 상태 (매 태스크 완료 시 DB 저장)
  tasks: Record<string, PipelineTaskStatus>;
  previews: Record<string, string>;
  results: PipelineTaskResults;
  errors: Record<string, string>;
  // 캐시 (Phase 간 DB 재조회)
  cachedSeteks?: CachedSetek[] | null;
  cachedChangche?: CachedChangche[] | null;
  cachedHaengteuk?: CachedHaengteuk[] | null;
  coursePlanData?: import("./types").CoursePlanTabData | null;
  // NEIS 기반 해소 데이터 (Step 1 이후 항상 세팅)
  resolvedRecords?: ResolvedRecordsByGrade;
  neisGrades?: number[];
  consultingGrades?: number[];
  // 학년 단위 파이프라인 (Step 1: grade partitioning)
  /** 파이프라인 유형. legacy = 기존 단일 파이프라인, grade = 학년별, synthesis = 종합. */
  pipelineType: "legacy" | "grade" | "synthesis";
  /** grade 파이프라인일 때 처리 대상 학년 (1/2/3). */
  targetGrade?: number;
  /** synthesis 파이프라인일 때 의존하는 grade 파이프라인 ID 목록 (완료 판정 등에 사용). */
  gradePipelineIds?: string[];
  /**
   * Phase 1-3(역량 분석) 완료 후 수집된 분석 맥락.
   * Phase 4-6(가이드 생성)에서 직접 참조하여 약점/이슈 기반 가이드 작성.
   * ctx.results(untyped)와 별도로 typed 필드로 관리.
   */
  analysisContext?: AnalysisContextByGrade;
  /** Grade Pipeline의 모드: analysis(NEIS) 또는 design(수강계획 기반 설계) */
  gradeMode?: "analysis" | "design";
  /** Synthesis Pipeline용 통합 학년 입력 (buildUnifiedGradeInput으로 1회 구성) */
  unifiedInput?: import("./pipeline-unified-input").UnifiedGradeInput;
  /** 레벨링 결과 캐시 (P7에서 1회 산출, P8/Synthesis에서 재사용) */
  leveling?: import("./leveling/types").LevelingResult;
}

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
// 태스크 의존 관계 (순수 함수, 테스트 가능)
// ============================================

/** 상류 태스크 → 하류 의존 태스크 매핑 */
/**
 * 상류 태스크 → 하류 의존 태스크 매핑 (전이적 폐쇄)
 * computeCascadeResetKeys()가 1단계만 확장하므로, 각 키에 직접+간접 의존 태스크를 모두 나열해야 합니다.
 * 예: storyline → edge → diagnosis → strategy 이면, storyline 항목에 strategy도 포함
 */
export const PIPELINE_TASK_DEPENDENTS: Partial<Record<PipelineTaskKey, PipelineTaskKey[]>> = {
  competency_analysis: ["slot_generation", "storyline_generation", "edge_computation", "guide_matching", "ai_diagnosis", "setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  storyline_generation: ["edge_computation", "guide_matching", "ai_diagnosis", "setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  edge_computation: ["ai_diagnosis", "setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  guide_matching: ["setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "roadmap_generation"],
  ai_diagnosis: ["setek_guide", "changche_guide", "haengteuk_guide", "ai_strategy", "interview_generation", "roadmap_generation"],
  setek_guide: ["changche_guide", "haengteuk_guide", "roadmap_generation"],
  changche_guide: ["haengteuk_guide", "roadmap_generation"],
  haengteuk_guide: ["roadmap_generation"],
};

/**
 * 재실행할 태스크 + cascade 의존 태스크 셋 계산
 * rerunPipelineTasks에서 사용하는 순수 로직
 */
export function computeCascadeResetKeys(taskKeys: PipelineTaskKey[]): Set<PipelineTaskKey> {
  const toReset = new Set<PipelineTaskKey>(taskKeys);
  for (const key of taskKeys) {
    for (const dep of PIPELINE_TASK_DEPENDENTS[key] ?? []) toReset.add(dep);
  }
  return toReset;
}

// ============================================
// Phase → Task Key 매핑 (Phase 순서 검증용)
// ============================================

export const GRADE_PHASE_TASKS: Record<number, GradePipelineTaskKey[]> = {
  1: ["competency_setek"],
  2: ["competency_changche"],
  3: ["competency_haengteuk"],
  4: ["setek_guide", "slot_generation"],
  5: ["changche_guide"],
  6: ["haengteuk_guide"],
  7: ["draft_generation"],
  8: ["draft_analysis"],
};

export const SYNTHESIS_PHASE_TASKS: Record<number, SynthesisPipelineTaskKey[]> = {
  1: ["storyline_generation"],
  2: ["edge_computation", "guide_matching"],
  3: ["ai_diagnosis", "course_recommendation"],
  4: ["bypass_analysis"],
  5: ["activity_summary", "ai_strategy"],
  6: ["interview_generation", "roadmap_generation"],
};

// ============================================
// Pipeline Snapshot (P2-3: 재실행 히스토리)
// ============================================

export interface PipelineSnapshot {
  id: string;
  pipeline_id: string;
  snapshot: PipelineTaskResults;
  created_at: string;
}
