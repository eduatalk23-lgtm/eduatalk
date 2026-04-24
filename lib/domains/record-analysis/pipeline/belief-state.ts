// ============================================
// BeliefState — 비선형 재조직 로드맵 Step 3 (2026-04-24)
//
// 학생에 대한 파이프라인 공용 "세계 이해" 상태. 파편적 ctx 필드(`profileCard`,
// `analysisContext`, `gradeThemes`, `blueprint`, `qualityPatterns`,
// `previousRunOutputs`, `resolvedRecords`)를 점진적으로 `ctx.belief` 로 통합한다.
//
// Step 3: profileCard 래핑으로 패턴 검증.
// α 후속 1: gradeThemes 편입 (2026-04-24).
// 기존 `ctx.profileCard` / `ctx.gradeThemes` 경로 **유지** — dual write alias.
// 소비처 무수정. 나머지 belief 필드는 후속 Sprint 에서 순차 편입.
//
// profileCard 3-state invariant (pipeline-types.ts:563-569 주석):
//   undefined = 미빌드 / "" = 빌드했으나 빈 카드 / "..." = 빌드 완료
// gradeThemes invalidation: targetGrade 변경 시 자동 교체 (학년 단위 LLM 출력).
//   undefined = 미실행/실패(graceful) / GradeThemeExtractionResult = 완료
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
}

/** 빈 BeliefState 초기값 — `loadPipelineContext` 에서 사용. */
export function createEmptyBeliefState(): BeliefState {
  return {};
}
