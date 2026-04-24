// ============================================
// BeliefState — 비선형 재조직 로드맵 Step 3 (2026-04-24)
//
// 학생에 대한 파이프라인 공용 "세계 이해" 상태. 파편적 ctx 필드(`profileCard`,
// `analysisContext`, `gradeThemes`, `blueprint`, `qualityPatterns`,
// `previousRunOutputs`, `resolvedRecords`)를 점진적으로 `ctx.belief` 로 통합한다.
//
// 이 Sprint(Step 3) 에서는 **가장 안전한 필드인 profileCard 만** 래핑해
// 패턴을 검증한다. 기존 `ctx.profileCard` 경로는 **유지** — dual write alias 로
// 소비처 무수정. 나머지 belief 필드는 후속 Sprint 에서 순차 편입.
//
// 3-state invariant 유지 (pipeline-types.ts:563-569 주석):
//   undefined = 미빌드 / "" = 빌드했으나 빈 카드 / "..." = 빌드 완료
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
}

/** 빈 BeliefState 초기값 — `loadPipelineContext` 에서 사용. */
export function createEmptyBeliefState(): BeliefState {
  return {};
}
