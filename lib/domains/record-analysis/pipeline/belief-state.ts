// ============================================
// BeliefState — 비선형 재조직 로드맵 Step 3 (2026-04-24)
//
// 학생에 대한 파이프라인 공용 "세계 이해" 상태. 파편적 ctx 필드(`profileCard`,
// `analysisContext`, `gradeThemes`, `blueprint`, `qualityPatterns`,
// `previousRunOutputs`, `resolvedRecords`)를 점진적으로 `ctx.belief` 로 통합한다.
//
// Step 3: profileCard 래핑으로 패턴 검증.
// α 후속 1: gradeThemes 편입 (2026-04-24).
// α 후속 2: blueprint 편입 (2026-04-24).
// α 후속 3: qualityPatterns 편입 (2026-04-24).
// α 후속 4: previousRunOutputs 편입 (2026-04-24).
// α 후속 5: analysisContext 편입 (2026-04-24).
// 기존 `ctx.profileCard` / `ctx.gradeThemes` / `ctx.blueprint` / `ctx.qualityPatterns` / `ctx.previousRunOutputs` / `ctx.analysisContext` 경로 **유지** — dual write alias.
// 소비처 무수정. 나머지 belief 필드는 후속 Sprint 에서 순차 편입.
//
// profileCard 3-state invariant (pipeline-types.ts:563-569 주석):
//   undefined = 미빌드 / "" = 빌드했으나 빈 카드 / "..." = 빌드 완료
// gradeThemes invalidation: targetGrade 변경 시 자동 교체 (학년 단위 LLM 출력).
//   undefined = 미실행/실패(graceful) / GradeThemeExtractionResult = 완료
// blueprint: 설계 모드 1회 로드 (analysis 모드 = undefined, 로드 실패 = undefined graceful).
//   undefined = 분석 모드 또는 로드 실패 / BlueprintPhaseOutput = 로드 완료
// qualityPatterns: S3 aggregateQualityPatterns 1회 집계 → S5 재시작 시 재집계 또는 executor 복원.
//   undefined = 미집계 또는 집계 실패(graceful) / Array = 집계 완료
// previousRunOutputs: loadPipelineContext 에서 1회 로드 (DB 직전 completed 파이프라인 스냅샷).
//   undefined = 로드 미진입 파이프라인 / { runId: null, ... } = 최초 실행 / { runId: "...", ... } = 로드 완료
// analysisContext: Phase 1-3(역량 분석) collectAnalysisContext 로 점진 축적. 학년별 구조 그대로 보존.
//   executor restore: task_results._analysisContext 에서 복원 시 belief 에도 seed.
//   undefined = Phase 1-3 미실행 또는 NEIS 레코드 없음 / { [grade]: GradeAnalysisContext } = 1개 이상 학년 완료
// ============================================

export interface BeliefState {
  /**
   * Layer 0 학생 프로필 카드 (렌더된 프롬프트 섹션 문자열).
   * P1-P3 진입 시 1회 빌드 후 재사용.
   * 3-state: undefined / "" / "..."
   *
   * dual write 하위 호환: `ctx.profileCard` 와 값 동기화 (한 세션 내 alias).
   */
  profileCard?: string;

  /**
   * H1 cross-subject theme 추출 결과 (학년 단위, P3.5 1회 실행).
   * P4~P6 가이드 프롬프트에 dominantThemes 로 주입된다.
   * undefined = 미실행 또는 실패/스킵 (graceful degradation — 가이드는 themes 없이 동작).
   *
   * dual write 하위 호환: `ctx.gradeThemes` 와 값 동기화 (한 세션 내 alias).
   * invalidation: targetGrade 변경 시 학년 단위로 교체됨 (파이프라인 러너가 덮어씀).
   */
  gradeThemes?: import("../llm/types").GradeThemeExtractionResult;

  /**
   * Blueprint 설계 산출물 캐시 (설계 모드 Grade Pipeline 전용, Phase 4 진입 시 1회 로드).
   * P4~P7 가이드/드래프트 프롬프트에 buildBlueprintGuideSection 으로 주입된다.
   * undefined = 분석 모드 또는 로드 실패 (graceful degradation — 가이드는 blueprint 없이 동작).
   *
   * dual write 하위 호환: `ctx.blueprint` 와 값 동기화 (한 세션 내 alias).
   * invalidation: 설계 모드 최초 진입 시 1회 로드 — 재로드 조건 없음 (세션 내 불변).
   */
  blueprint?: import("../blueprint/types").BlueprintPhaseOutput;

  /**
   * 전 학년 반복 품질 패턴 집계 결과 (Synthesis S3 aggregateQualityPatterns 1회 산출).
   * S5 전략 생성에 qualityPatterns[] 로 주입된다.
   * S5 Phase 재시작 시: ctx.qualityPatterns 유실이면 재집계 후 동기화.
   * executor loadPipelineContext: ai_diagnosis task_result 에서 복원 시 동기화.
   * undefined = 미집계 또는 집계 실패/빈 결과 (graceful degradation — 전략은 패턴 없이 동작).
   *
   * dual write 하위 호환: `ctx.qualityPatterns` 와 값 동기화 (한 세션 내 alias).
   * invalidation: Synthesis 세션당 1회 집계 — 재집계 조건: S5 Phase 재시작 시 ctx 유실.
   */
  qualityPatterns?: Array<{ pattern: string; count: number; subjects: string[] }>;

  /**
   * Cross-run feedback 인프라 — 동일 pipeline_type 의 직전 completed 파이프라인 task_results 스냅샷.
   * loadPipelineContext 에서 1회 로드 (DB 재조회 없음). S1/S2/S3/S5/B1 가 `ctx.previousRunOutputs` 를 읽어
   * 직전 실행 산출물(activity_summary, interview, course_recommendation, gap_tracking, haengteuk_linking)을
   * 프롬프트 힌트로 주입한다.
   * undefined = 로드 미진입 파이프라인 / { runId: null, ... } = 최초 실행(정상) / { runId: "...", ... } = 로드 완료.
   *
   * dual write 하위 호환: `ctx.previousRunOutputs` 와 값 동기화 (한 세션 내 alias).
   * invalidation: loadPipelineContext 호출 시 항상 최신 DB 조회 — 세션 내 불변(재로드 조건 없음).
   * executor restore: previousRunOutputs 는 DB 에서 항상 새로 로드되므로 task_results 에서 복원하지 않음.
   */
  previousRunOutputs?: import("./pipeline-types").PreviousRunOutputs;

  /**
   * Phase 1-3(역량 분석) 완료 후 수집된 분석 맥락 (학년별 구조).
   * `collectAnalysisContext()` 가 setek/changche/haengteuk 완료 시마다 점진 축적.
   * P8(draft_analysis) 도 weak competencies 를 동일 구조에 누적.
   * Phase 4-6(가이드 생성) 에서 issues/약점 기반 프롬프트 주입에 소비된다.
   * 학년별 구조(`{ [grade]: GradeAnalysisContext }`)를 그대로 유지 — 학년별 분해 금지.
   *
   * dual write 하위 호환: `ctx.analysisContext` 와 값 동기화 (한 세션 내 alias).
   * invalidation: collectAnalysisContext 호출 시 점진 갱신 — 두 alias 는 항상 동일 객체 참조.
   * executor restore: task_results._analysisContext 에서 복원 시 belief 에도 seed
   *   (loadPipelineContext 의 `persistedAnalysisContext` 경로).
   */
  analysisContext?: import("./pipeline-types").AnalysisContextByGrade;
}

/** 빈 BeliefState 초기값 — `loadPipelineContext` 에서 사용. */
export function createEmptyBeliefState(): BeliefState {
  return {};
}
