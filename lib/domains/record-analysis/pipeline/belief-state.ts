// ============================================
// BeliefState — 파이프라인 공용 "세계 이해" 상태
//
// 학생에 대한 파이프라인이 축적하는 모든 공용 상태를 `ctx.belief` 하나로 관리한다.
// 이전에는 `ctx.profileCard` / `ctx.analysisContext` / `ctx.gradeThemes` / `ctx.blueprint`
// / `ctx.qualityPatterns` / `ctx.previousRunOutputs` / `ctx.resolvedRecords` 7 필드가
// ctx 최상위에 흩어져 있었으나, 현재는 모두 `ctx.belief.*` 단일 write.
//
// 각 필드별 invariants:
//
// - profileCard (Layer 0 학생 프로필 카드, 렌더된 프롬프트 섹션 문자열)
//   · 3-state: undefined=미빌드 / ""=빌드했으나 데이터 없음 / "..."=빌드 완료
//   · P1~P3 진입 시 1회 빌드 후 재사용.
//
// - gradeThemes (H1 cross-subject theme 추출 결과, 학년 단위)
//   · P3.5 에서 학년당 1회 실행, P4~P6 가이드 프롬프트에 dominantThemes 로 주입.
//   · targetGrade 변경 시 학년 단위로 덮어씀. 실패/스킵 시 undefined (graceful).
//
// - blueprint (설계 산출물 캐시, 설계 모드 전용)
//   · Grade Pipeline 설계 모드 Phase 4 진입 시 1회 로드. 세션 내 불변.
//   · 분석 모드 또는 로드 실패 = undefined (graceful).
//
// - qualityPatterns (전 학년 반복 품질 패턴 집계, Synthesis 산출)
//   · S3 aggregateQualityPatterns 1회 집계 → S5 전략 생성에 주입.
//   · S5 Phase 재시작 시 유실이면 재집계.
//   · executor loadPipelineContext 가 ai_diagnosis task_result 에서 복원하여 seed.
//
// - previousRunOutputs (Cross-run feedback 인프라)
//   · 동일 pipeline_type 의 직전 completed 파이프라인 task_results 스냅샷.
//   · loadPipelineContext 1회 로드. S1/S2/S3/S5/B1 이 프롬프트 힌트로 주입.
//   · { runId: null, ... } = 최초 실행(정상 케이스).
//
// - analysisContext (Phase 1-3 분석 맥락, 학년별 구조)
//   · collectAnalysisContext() 가 setek/changche/haengteuk 완료 시마다 점진 축적.
//   · P8(draft_analysis) 도 weak competencies 를 동일 구조에 누적.
//   · P4-P6 가이드 생성에서 issues/약점 기반 프롬프트 주입에 소비.
//   · Phase 분할 재시작 복원: task_results._analysisContext 에서 belief 로 seed
//     (loadPipelineContext 의 persistedAnalysisContext 경로).
//
// - resolvedRecords (NEIS 기반 해소 데이터, 학년별 구조)
//   · loadPipelineContext 매 호출마다 DB 에서 신규 계산. 세션 내 불변.
//   · Grade Pipeline 전용 (Synthesis 에서는 undefined).
//   · `ctx.belief.resolvedRecords?.[targetGrade]` 로 학년별 콘텐츠 해소.
//   · 빈 객체({})는 "해소 완료, 레코드 0건" — Synthesis(undefined) 와 구분.
// ============================================

export interface BeliefState {
  /**
   * Layer 0 학생 프로필 카드 (렌더된 프롬프트 섹션 문자열).
   * P1-P3 진입 시 1회 빌드 후 재사용.
   * 3-state: undefined=미빌드 / ""=빌드했으나 빈 카드 / "..."=빌드 완료.
   */
  profileCard?: string;

  /**
   * H1 cross-subject theme 추출 결과 (학년 단위, P3.5 1회 실행).
   * P4~P6 가이드 프롬프트에 dominantThemes 로 주입.
   * targetGrade 변경 시 학년 단위로 교체. undefined = 미실행/실패(graceful).
   * Grade Pipeline 단일 학년 전용. Synthesis 에서는 gradeThemesByGrade 를 사용.
   */
  gradeThemes?: import("../llm/types").GradeThemeExtractionResult;

  /**
   * Synthesis 전용: 전 학년 cross-subject theme 집계 (학년별 dict).
   * loadSynthesisCumulativeBelief 에서 aggregateGradeThemes() 호출로 시딩.
   * S3/S5/S6/S7 프롬프트에 buildGradeThemesByGradeSection() 으로 변환해 주입.
   * undefined = 시딩 미수행/실패(graceful).
   */
  gradeThemesByGrade?: import("./synthesis/helpers").GradeThemesByGrade;

  /**
   * Blueprint 설계 산출물 캐시 (설계 모드 Grade Pipeline 전용).
   * Phase 4 진입 시 1회 로드, 세션 내 불변.
   * undefined = 분석 모드 또는 로드 실패(graceful).
   */
  blueprint?: import("../blueprint/types").BlueprintPhaseOutput;

  /**
   * 전 학년 반복 품질 패턴 집계 결과 (Synthesis S3 aggregateQualityPatterns).
   * S5 전략 생성에 주입. S5 재시작 시 유실이면 재집계.
   * executor restore: ai_diagnosis task_result 에서 복원 시 seed.
   * undefined = 미집계 또는 빈 결과(graceful).
   */
  qualityPatterns?: Array<{ pattern: string; count: number; subjects: string[] }>;

  /**
   * Cross-run feedback — 직전 completed 파이프라인 task_results 스냅샷.
   * loadPipelineContext 에서 1회 로드. 세션 내 불변.
   * S1/S2/S3/S5/B1 가 프롬프트 힌트로 주입.
   * undefined = 로드 미진입 / { runId: null, ... } = 최초 실행 / { runId: "...", ... } = 로드 완료.
   */
  previousRunOutputs?: import("./pipeline-types").PreviousRunOutputs;

  /**
   * Phase 1-3 분석 맥락 (학년별 구조).
   * collectAnalysisContext 로 점진 축적. P8 도 weak competencies 를 누적.
   * Phase 4-6 가이드 생성에서 issues/약점 기반 프롬프트 주입에 소비.
   * Phase 분할 재시작 복원: task_results._analysisContext → belief seed.
   */
  analysisContext?: import("./pipeline-types").AnalysisContextByGrade;

  /**
   * NEIS 기반 해소 데이터 (학년별 구조). Grade Pipeline 전용.
   * loadPipelineContext 매 호출마다 DB 에서 신규 계산, 세션 내 불변.
   * `belief.resolvedRecords?.[targetGrade]` 로 학년별 effectiveContent 해소.
   * 빈 객체({}) = 해소 완료·레코드 0건 (Synthesis 의 undefined 와 구분).
   */
  resolvedRecords?: import("./pipeline-types").ResolvedRecordsByGrade;
}

/** 빈 BeliefState 초기값 — `loadPipelineContext` 에서 사용. */
export function createEmptyBeliefState(): BeliefState {
  return {};
}
