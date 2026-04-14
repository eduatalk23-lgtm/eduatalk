// ============================================
// AI 생기부 분석 파이프라인 상수
// 태스크 키, 레이블, 타임아웃, 의존 관계, Phase 매핑
// (pipeline-types.ts에서 분리)
// ============================================

/** @deprecated 레거시 단일 파이프라인용. 신규는 GRADE_PIPELINE_TASK_KEYS / SYNTHESIS_PIPELINE_TASK_KEYS 사용. */
export const PIPELINE_TASK_KEYS = [
  "competency_analysis",     // 1st: 역량 태그 + 등급 생성
  "storyline_generation",    // 2nd: 기록 분석 → 스토리라인 감지 (진단보다 먼저)
  "edge_computation",        // 3rd: 태그+스토리라인 → 7종 엣지 영속화
  "hyperedge_computation",   // 3rd': Layer 2 N-ary 수렴 엣지 (승격)
  "narrative_arc_extraction",// 3rd'': Layer 3 레코드별 8단계 서사 태깅 (승격+청크)
  "ai_diagnosis",            // 4th: 역량+엣지 → 종합진단(강점/약점)
  "course_recommendation",   // 5th: 수강 추천 (독립)
  "slot_generation",         // NEIS 없는 학년의 세특/창체/행특 슬롯 자동 생성 (Grade GP4에서도 실행)
  "guide_matching",          // 6th: 가이드 배정 (독립)
  "haengteuk_linking",       // 6th': 행특↔탐구 가이드 링크 (승격)
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
// 학년 단위 파이프라인 태스크 (Grade Pipeline — 학년별 9개)
// ============================================

export const GRADE_PIPELINE_TASK_KEYS = [
  "competency_setek",
  "competency_changche",
  "competency_haengteuk",
  "cross_subject_theme_extraction",
  "setek_guide",
  "slot_generation",
  "changche_guide",
  "haengteuk_guide",
  "draft_generation",
  "draft_analysis",
] as const;

// ============================================
// 종합 파이프라인 태스크 (Synthesis Pipeline — 종합 10개)
// ============================================

export const SYNTHESIS_PIPELINE_TASK_KEYS = [
  "storyline_generation",
  "edge_computation",
  "hyperedge_computation",
  "narrative_arc_extraction",
  "ai_diagnosis",
  "course_recommendation",
  "guide_matching",
  "haengteuk_linking",
  "bypass_analysis",
  "activity_summary",
  "ai_strategy",
  "interview_generation",
  "roadmap_generation",
] as const;

// Local type aliases — avoids importing from pipeline-types.ts (which imports us)
type _GradeKey = (typeof GRADE_PIPELINE_TASK_KEYS)[number];
type _SynthKey = (typeof SYNTHESIS_PIPELINE_TASK_KEYS)[number];
type _LegacyKey = (typeof PIPELINE_TASK_KEYS)[number];

// ============================================
// 의존성 역산 유틸
// ============================================

/**
 * DEPENDENTS(상류→하류[]) 맵에서 PREREQUISITES(하류→상류[]) 맵을 자동 생성.
 * 수동 동기화 없이 DEPENDENTS만 관리하면 PREREQUISITES가 자동 파생된다.
 */
function invertDependents<T extends string>(
  dependents: Partial<Record<T, T[]>>,
): Partial<Record<T, T[]>> {
  const prereqs: Partial<Record<T, T[]>> = {};
  for (const [upstream, downstreams] of Object.entries(dependents) as [T, T[]][]) {
    for (const downstream of downstreams) {
      if (!prereqs[downstream]) prereqs[downstream] = [];
      prereqs[downstream]!.push(upstream);
    }
  }
  return prereqs;
}

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
export const GRADE_TASK_DEPENDENTS: Partial<Record<_GradeKey, _GradeKey[]>> = {
  competency_setek: ["slot_generation", "setek_guide", "changche_guide", "haengteuk_guide", "cross_subject_theme_extraction"],
  competency_changche: ["slot_generation", "changche_guide", "haengteuk_guide", "cross_subject_theme_extraction"],
  competency_haengteuk: ["slot_generation", "haengteuk_guide", "cross_subject_theme_extraction"],
  // cross_subject_theme_extraction은 가이드의 강한 prereq가 아님 — 실패해도 가이드는 themes 없이 진행 (graceful degradation).
  // 따라서 setek_guide/changche_guide/haengteuk_guide의 prereq에는 추가하지 않는다.
  setek_guide: ["changche_guide", "haengteuk_guide", "draft_generation"],
  changche_guide: ["haengteuk_guide", "draft_generation"],
  haengteuk_guide: ["draft_generation", "draft_analysis"],
  draft_generation: ["draft_analysis"],
};

// ============================================
// Grade 선행 필수 태스크 (GRADE_TASK_DEPENDENTS에서 자동 역산)
// ============================================

/**
 * 태스크별 선행 필수 태스크 목록.
 * 선행 태스크 중 하나라도 failed이면 해당 태스크를 자동 스킵한다.
 * GRADE_TASK_DEPENDENTS에서 자동 생성 — 수동 동기화 불필요.
 */
export const GRADE_TASK_PREREQUISITES: Partial<Record<_GradeKey, _GradeKey[]>> =
  invertDependents(GRADE_TASK_DEPENDENTS);

// ============================================
// Synthesis 의존 관계 (Synthesis Pipeline 내부)
// ============================================

/**
 * Synthesis 파이프라인 내 상류 태스크 → 하류 의존 태스크 매핑 (전이적 폐쇄).
 * 기존 PIPELINE_TASK_DEPENDENTS에서 synthesis 태스크만 추출.
 */
export const SYNTHESIS_TASK_DEPENDENTS: Partial<Record<_SynthKey, _SynthKey[]>> = {
  storyline_generation: ["edge_computation", "hyperedge_computation", "ai_diagnosis", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  edge_computation: ["hyperedge_computation", "ai_diagnosis", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  // hyperedge_computation은 ai_strategy 프롬프트에 테마 요약을 주입하지만, 없어도 graceful degradation이라
  // strategy의 prereq로 걸지는 않는다. (D8 설계 — best-effort → task 승격 후에도 soft 의존 유지)
  guide_matching: ["haengteuk_linking", "activity_summary", "roadmap_generation"],
  ai_diagnosis: ["ai_strategy", "interview_generation", "roadmap_generation"],
};

/**
 * Synthesis 파이프라인 선행 태스크 목록.
 * SYNTHESIS_TASK_DEPENDENTS에서 자동 생성 — 수동 동기화 불필요.
 */
export const SYNTHESIS_TASK_PREREQUISITES: Partial<Record<_SynthKey, _SynthKey[]>> =
  invertDependents(SYNTHESIS_TASK_DEPENDENTS);

// ============================================
// Grade Pipeline 전용 레이블/타임아웃
// ============================================

export const GRADE_PIPELINE_TASK_LABELS: Record<_GradeKey, string> = {
  competency_setek: "세특 역량 분석",
  competency_changche: "창체 역량 분석",
  competency_haengteuk: "행특 역량 분석",
  cross_subject_theme_extraction: "과목 교차 테마",
  setek_guide: "세특 방향",
  slot_generation: "슬롯 생성",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
  draft_generation: "가안 생성",
  draft_analysis: "가안 분석",
};

/** Grade Pipeline 태스크별 타임아웃 (ms) */
export const GRADE_PIPELINE_TASK_TIMEOUTS: Record<_GradeKey, number> = {
  competency_setek: 280_000,   // 세특이 가장 오래 걸림 (Vercel 5분 제한 내 여유)
  competency_changche: 120_000,
  competency_haengteuk: 120_000,
  cross_subject_theme_extraction: 120_000,
  setek_guide: 120_000,
  slot_generation: 30_000,
  changche_guide: 120_000,
  haengteuk_guide: 120_000,
  draft_generation: 240_000,  // 세특+창체+행특 가안 순차 생성
  draft_analysis: 280_000,   // 가안 역량 분석 (세특이 가장 오래)
};

export const PIPELINE_TASK_LABELS: Record<_LegacyKey, string> = {
  competency_analysis: "역량 분석",
  storyline_generation: "스토리라인 감지",
  edge_computation: "연결 분석",
  hyperedge_computation: "통합 테마",
  narrative_arc_extraction: "서사 태깅",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  slot_generation: "슬롯 생성",
  guide_matching: "가이드 매칭",
  haengteuk_linking: "행특 링크",
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
export const PIPELINE_TASK_TIMEOUTS: Record<_LegacyKey, number> = {
  competency_analysis: 280_000,   // 4분 40초 (다건 배치 — Vercel 5분 제한 내 여유)
  storyline_generation: 120_000,
  edge_computation: 30_000,       // CPU 기반 (5-10s)
  hyperedge_computation: 60_000,  // D-track(2026-04-14): 승격. CPU 기반 (pair-seed union-find, <10s). 여유.
  narrative_arc_extraction: 280_000, // D-track(2026-04-14): 청크 모드 기본. chunkSize=4 × LLM ~10s × 3 concurrency ≈ ~15s/청크.
                                  //   단일 route 최대 280s → chunkSize 크게 주어도 한 청크 내 안전.
  ai_diagnosis: 120_000,          // 2분 (실제 20-30s, 여유 포함)
  course_recommendation: 120_000,
  slot_generation: 30_000,        // 30초 (DB upsert 위주)
  guide_matching: 200_000,        // P2(2026-04-14): Phase A LLM 설계 + design 4건 풀매칭/셸생성 +
                                  //   Phase B fallback이 한 태스크에 묶여 있어 60s 초과. LLM 태스크 수준 상향.
  haengteuk_linking: 90_000,      // D-track(2026-04-14): 승격. Flash × N학년(보통 3회) ≈ 30~60s.
  bypass_analysis: 120_000,
  setek_guide: 120_000,
  changche_guide: 120_000,
  haengteuk_guide: 120_000,
  activity_summary: 120_000,
  ai_strategy: 120_000,
  interview_generation: 120_000,
  roadmap_generation: 120_000,
};

// ============================================
// 태스크 의존 관계 — 레거시 단일 파이프라인용
// ============================================

/**
 * 상류 태스크 → 하류 의존 태스크 매핑 (전이적 폐쇄)
 * computeCascadeResetKeys()가 1단계만 확장하므로, 각 키에 직접+간접 의존 태스크를 모두 나열해야 합니다.
 * 예: storyline → edge → diagnosis → strategy 이면, storyline 항목에 strategy도 포함
 */
export const PIPELINE_TASK_DEPENDENTS: Partial<Record<_LegacyKey, _LegacyKey[]>> = {
  competency_analysis: ["slot_generation", "storyline_generation", "edge_computation", "guide_matching", "ai_diagnosis", "setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  storyline_generation: ["edge_computation", "guide_matching", "ai_diagnosis", "setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  edge_computation: ["ai_diagnosis", "setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  guide_matching: ["setek_guide", "changche_guide", "haengteuk_guide", "activity_summary", "roadmap_generation"],
  ai_diagnosis: ["setek_guide", "changche_guide", "haengteuk_guide", "ai_strategy", "interview_generation", "roadmap_generation"],
  setek_guide: ["changche_guide", "haengteuk_guide", "roadmap_generation"],
  changche_guide: ["haengteuk_guide", "roadmap_generation"],
  haengteuk_guide: ["roadmap_generation"],
};

// ============================================
// Phase → Task Key 매핑 (Phase 순서 검증용)
// ============================================

export const GRADE_PHASE_TASKS: Record<number, _GradeKey[]> = {
  1: ["competency_setek"],
  2: ["competency_changche"],
  3: ["competency_haengteuk"],
  4: ["setek_guide", "slot_generation"],
  5: ["changche_guide"],
  6: ["haengteuk_guide"],
  7: ["draft_generation"],
  8: ["draft_analysis"],
};

export const SYNTHESIS_PHASE_TASKS: Record<number, _SynthKey[]> = {
  1: ["storyline_generation"],
  // Phase 2는 narrative chunk sub-route에서 선행 처리 후 메인 route에서 나머지 4 task 처리.
  // 모두 동일 phase 2 소속(UI 탭 단일화 유지).
  2: [
    "narrative_arc_extraction",
    "edge_computation",
    "hyperedge_computation",
    "guide_matching",
    "haengteuk_linking",
  ],
  3: ["ai_diagnosis", "course_recommendation"],
  4: ["bypass_analysis"],
  5: ["activity_summary", "ai_strategy"],
  6: ["interview_generation", "roadmap_generation"],
};
