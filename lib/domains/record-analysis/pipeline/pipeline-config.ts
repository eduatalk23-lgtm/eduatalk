// ============================================
// AI 생기부 분석 파이프라인 상수
// 태스크 키, 레이블, 타임아웃, 의존 관계, Phase 매핑
// (pipeline-types.ts에서 분리)
// ============================================

/** @deprecated 레거시 단일 파이프라인용. 신규는 GRADE_PIPELINE_TASK_KEYS / SYNTHESIS_PIPELINE_TASK_KEYS 사용. */
export const PIPELINE_TASK_KEYS = [
  "competency_analysis",     // 1st: 역량 태그 + 등급 생성
  "storyline_generation",    // 2nd: 기록 분석 → 스토리라인 감지 (진단보다 먼저)
  "blueprint_generation",    // 2.5th: 진로→3년 수렴 설계 (top-down)
  "edge_computation",        // 3rd: 태그+스토리라인 → 7종 엣지 영속화
  "hyperedge_computation",   // 3rd': Layer 2 N-ary 수렴 엣지 (승격)
  "narrative_arc_extraction",// 3rd'': Layer 3 레코드별 8단계 서사 태깅 (승격+청크)
  "ai_diagnosis",            // 4th: 역량+엣지 → 종합진단(강점/약점)
  "course_recommendation",   // 5th: 수강 추천 (독립)
  "slot_generation",         // NEIS 없는 학년의 세특/창체/행특 슬롯 자동 생성 (Grade GP4에서도 실행)
  "guide_matching",          // 6th: 가이드 배정 (독립)
  "haengteuk_linking",       // 6th': 행특↔탐구 가이드 링크 (승격)
  "gap_tracking",             // 6.5th: blueprint vs analysis 정합성 + bridge 생성
  "bypass_analysis",         // 7th: 우회학과 분석 (독립, Phase 2)
  "setek_guide",             // 8th: 진단+엣지 → 세특 방향
  "changche_guide",          // 9th: 세특방향 → 창체 방향 (Phase 3b)
  "haengteuk_guide",         // 10th: 창체방향 → 행특 방향 (Phase 3c)
  "activity_summary",        // 11th: 스토리라인+엣지 → 활동 요약서
  "ai_strategy",             // 12th: 진단 약점+부족역량 → 보완전략 자동 제안
  "interview_generation",    // 13th: 기록+진단 → 면접 예상 질문 생성
  "roadmap_generation",      // 14th: 진단+스토리라인+세특/창체/행특방향 → 학기별 로드맵
  "tier_plan_refinement",    // 15th: Synthesis → main_exploration 피드백 루프 (Phase 4b Sprint 3)
] as const;

// ============================================
// 학년 단위 파이프라인 태스크 (Grade Pipeline — 학년별 9개)
// ============================================

export const GRADE_PIPELINE_TASK_KEYS = [
  "competency_setek",
  "competency_changche",
  "competency_haengteuk",
  "cross_subject_theme_extraction",
  "competency_volunteer",          // α1-2: 봉사 역량 태깅 + 반복 주제 추출 (P3.5 pre-task)
  "competency_awards",             // α1-4-b: 수상 역량 태깅 + 반복 주제 추출 (P3.5 pre-task)
  "derive_main_theme",             // P3.6 (M1-c W1, 2026-04-27): 메인 탐구주제 + cascadePlan capability 도출. graceful (실패해도 가이드 계속).
  "setek_guide",
  "slot_generation",
  "changche_guide",
  "haengteuk_guide",
  "draft_generation",
  "draft_analysis",
  "draft_refinement",   // P9: IMPROVE 논문 component-at-a-time iteration (Phase 5 Sprint 1)
] as const;

// ============================================
// 종합 파이프라인 태스크 (Synthesis Pipeline — 종합 10개)
// Note: blueprint_generation은 신규 blueprint 파이프라인으로 이전(2026-04-16 D).
// ============================================

export const SYNTHESIS_PIPELINE_TASK_KEYS = [
  "storyline_generation",
  "edge_computation",
  "hyperedge_computation",
  "narrative_arc_extraction",
  "ai_diagnosis",
  "course_recommendation",
  "gap_tracking",             // S3.5: blueprint vs analysis 정합성 + bridge 생성
  "guide_matching",
  "haengteuk_linking",
  "bypass_analysis",
  "activity_summary",
  "ai_strategy",
  "interview_generation",
  "roadmap_generation",
  "tier_plan_refinement",     // S7 (Phase 4b Sprint 3): Synthesis → main_exploration 피드백 루프
] as const;

// ============================================
// Past Analytics 파이프라인 태스크 (4축×3층 A층, 2026-04-16 D)
// NEIS만 기반 과거 서사·진단·행동 3종. k≥1(NEIS 학년 존재)일 때만 실행.
// ============================================

export const PAST_ANALYTICS_TASK_KEYS = [
  "past_storyline_generation",  // A1: NEIS 기반 과거 서사
  "past_diagnosis",             // A2: 현상 진단 (Storyline 참조)
  "past_strategy",              // A3: 즉시 행동 권고 (Diagnosis 참조)
] as const;

// ============================================
// Blueprint 파이프라인 태스크 (4축×3층 B층, 2026-04-16 D)
// 진로→3년 수렴 설계 (top-down). Synthesis에서 분리. k<3(설계 대상 학년 존재)일 때만 실행.
// ============================================

export const BLUEPRINT_TASK_KEYS = [
  "blueprint_generation",       // B1: target_convergences + milestones + competency_growth_targets
] as const;

// ============================================
// Bootstrap 파이프라인 태스크 (Phase 0 자동 셋업, 2026-04-18)
// target_major 진입 시 선결 조건 자동 보강. 모든 파이프라인보다 먼저 실행.
// ============================================

export const BOOTSTRAP_TASK_KEYS = [
  "target_major_validation",  // BT0: target_major 표준 키 검증
  "main_exploration_seed",    // BT1: 활성 main_exploration 없으면 LLM seed 생성
  "course_plan_recommend",    // BT2: course_plan 0건이면 추천 자동 생성
] as const;

// Local type aliases — avoids importing from pipeline-types.ts (which imports us)
type _GradeKey = (typeof GRADE_PIPELINE_TASK_KEYS)[number];
type _SynthKey = (typeof SYNTHESIS_PIPELINE_TASK_KEYS)[number];
type _LegacyKey = (typeof PIPELINE_TASK_KEYS)[number];
type _PastAnalyticsKey = (typeof PAST_ANALYTICS_TASK_KEYS)[number];
type _BlueprintKey = (typeof BLUEPRINT_TASK_KEYS)[number];
type _BootstrapKey = (typeof BOOTSTRAP_TASK_KEYS)[number];

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
  competency_setek: ["slot_generation", "setek_guide", "changche_guide", "haengteuk_guide", "cross_subject_theme_extraction", "derive_main_theme"],
  competency_changche: ["slot_generation", "changche_guide", "haengteuk_guide", "cross_subject_theme_extraction", "derive_main_theme"],
  competency_haengteuk: ["slot_generation", "haengteuk_guide", "cross_subject_theme_extraction", "derive_main_theme"],
  // cross_subject_theme_extraction은 가이드의 강한 prereq가 아님 — 실패해도 가이드는 themes 없이 진행 (graceful degradation).
  // 따라서 setek_guide/changche_guide/haengteuk_guide의 prereq에는 추가하지 않는다.
  // competency_volunteer: 선행 없음([]) — P1~P3와 독립. 실패해도 가이드는 계속 진행 (graceful).
  // competency_awards: 선행 없음([]) — P1~P3와 독립. 실패해도 가이드는 계속 진행 (graceful).
  // derive_main_theme (M1-c W1): competency_* 후행 (analysisContext 충족). cross_subject_theme_extraction graceful 의존
  //   (gradeThemes 있으면 키워드 보강, 없어도 진로만으로 도출 가능). 가이드 prereq 아님 — graceful terminal.
  cross_subject_theme_extraction: ["derive_main_theme"],
  setek_guide: ["changche_guide", "haengteuk_guide", "draft_generation"],
  changche_guide: ["haengteuk_guide", "draft_generation"],
  haengteuk_guide: ["draft_generation", "draft_analysis", "draft_refinement"],
  draft_generation: ["draft_analysis", "draft_refinement"],
  draft_analysis: ["draft_refinement"],
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
  edge_computation: ["hyperedge_computation", "ai_diagnosis", "gap_tracking", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  // hyperedge_computation은 ai_strategy 프롬프트에 테마 요약을 주입하지만, 없어도 graceful degradation이라
  // strategy의 prereq로 걸지는 않는다. (D8 설계 — best-effort → task 승격 후에도 soft 의존 유지)
  guide_matching: ["haengteuk_linking", "activity_summary", "roadmap_generation"],
  ai_diagnosis: ["gap_tracking", "ai_strategy", "interview_generation", "roadmap_generation", "tier_plan_refinement"],
  // Gap Tracker: blueprint + diagnosis 이후 실행. bridge 결과를 전략에 주입.
  gap_tracking: ["ai_strategy", "roadmap_generation"],
  // Phase 4b Sprint 3: tier_plan_refinement 는 S3 진단/S5 전략/S6 로드맵을 모두 입력으로 받음.
  ai_strategy: ["tier_plan_refinement"],
  roadmap_generation: ["tier_plan_refinement"],
};

/**
 * Synthesis 파이프라인 선행 태스크 목록.
 * SYNTHESIS_TASK_DEPENDENTS에서 자동 생성 — 수동 동기화 불필요.
 */
export const SYNTHESIS_TASK_PREREQUISITES: Partial<Record<_SynthKey, _SynthKey[]>> =
  invertDependents(SYNTHESIS_TASK_DEPENDENTS);

// ============================================
// Past Analytics 의존 관계 (내부 순차: A1 → A2 → A3)
// ============================================

/**
 * Past Analytics 파이프라인 내 상류 → 하류 매핑.
 * A1(Storyline) → A2(Diagnosis) → A3(Strategy) 단방향 순차.
 */
export const PAST_ANALYTICS_TASK_DEPENDENTS: Partial<Record<_PastAnalyticsKey, _PastAnalyticsKey[]>> = {
  past_storyline_generation: ["past_diagnosis", "past_strategy"],
  past_diagnosis: ["past_strategy"],
};

/**
 * Past Analytics 파이프라인 선행 태스크 목록.
 * PAST_ANALYTICS_TASK_DEPENDENTS에서 자동 생성 — 수동 동기화 불필요.
 */
export const PAST_ANALYTICS_TASK_PREREQUISITES: Partial<Record<_PastAnalyticsKey, _PastAnalyticsKey[]>> =
  invertDependents(PAST_ANALYTICS_TASK_DEPENDENTS);

// ============================================
// Grade Pipeline 전용 레이블/타임아웃
// ============================================

// ============================================
// Past Analytics / Blueprint 레이블·타임아웃
// ============================================

export const PAST_ANALYTICS_TASK_LABELS: Record<_PastAnalyticsKey, string> = {
  past_storyline_generation: "과거 서사",
  past_diagnosis: "현상 진단",
  past_strategy: "즉시 행동 권고",
};

export const PAST_ANALYTICS_TASK_TIMEOUTS: Record<_PastAnalyticsKey, number> = {
  past_storyline_generation: 180_000,  // NEIS 기반 서사 LLM (Flash, ~30s)
  past_diagnosis: 120_000,             // 현상 진단 LLM (Flash, ~20s)
  past_strategy: 120_000,              // 즉시 행동 권고 LLM (Flash, ~20s)
};

export const PAST_ANALYTICS_PHASE_TASKS: Record<number, _PastAnalyticsKey[]> = {
  1: ["past_storyline_generation"],
  2: ["past_diagnosis"],
  3: ["past_strategy"],
};

export const BLUEPRINT_TASK_LABELS: Record<_BlueprintKey, string> = {
  blueprint_generation: "수렴 설계",
};

// ============================================
// Bootstrap 레이블·타임아웃·Phase 매핑
// ============================================

export const BOOTSTRAP_TASK_LABELS: Record<_BootstrapKey, string> = {
  target_major_validation: "진로 계열 검증",
  main_exploration_seed: "메인 탐구 설정",
  course_plan_recommend: "수강 계획 추천",
};

export const BOOTSTRAP_TASK_TIMEOUTS: Record<_BootstrapKey, number> = {
  target_major_validation: 5_000,   // 동기 검증 — 즉각 응답
  main_exploration_seed: 60_000,    // Flash LLM seed (~10s) + Pro fallback
  course_plan_recommend: 30_000,    // 규칙 기반 추천 생성
};

/** Bootstrap 파이프라인은 단일 Phase 1 에 3 태스크 순차 실행 */
export const BOOTSTRAP_PHASE_TASKS: Record<number, _BootstrapKey[]> = {
  1: ["target_major_validation", "main_exploration_seed", "course_plan_recommend"],
};

export const BLUEPRINT_TASK_TIMEOUTS: Record<_BlueprintKey, number> = {
  blueprint_generation: 180_000,  // 기존 synthesis와 동일, 여유 포함
};

export const BLUEPRINT_PHASE_TASKS: Record<number, _BlueprintKey[]> = {
  1: ["blueprint_generation"],
};

// ============================================
// Grade Pipeline 전용 레이블/타임아웃
// ============================================

export const GRADE_PIPELINE_TASK_LABELS: Record<_GradeKey, string> = {
  competency_setek: "세특 역량 분석",
  competency_changche: "창체 역량 분석",
  competency_haengteuk: "행특 역량 분석",
  cross_subject_theme_extraction: "과목 교차 테마",
  competency_volunteer: "봉사 역량 태깅",  // α1-2
  competency_awards: "수상 역량 태깅",  // α1-4-b
  derive_main_theme: "메인 탐구주제 + 학년별 cascade",  // P3.6 (M1-c W1)
  setek_guide: "세특 방향",
  slot_generation: "슬롯 생성",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
  draft_generation: "가안 생성",
  draft_analysis: "가안 분석",
  draft_refinement: "가안 개선",  // P9
};

/** Grade Pipeline 태스크별 타임아웃 (ms) */
export const GRADE_PIPELINE_TASK_TIMEOUTS: Record<_GradeKey, number> = {
  competency_setek: 280_000,   // 세특이 가장 오래 걸림 (Vercel 5분 제한 내 여유)
  competency_changche: 120_000,
  competency_haengteuk: 120_000,
  // M1-c W6 (2026-04-27): fast tier 전환 후에도 14 records prompt 응답 여유 확보 (~30-60s 예상).
  cross_subject_theme_extraction: 180_000,
  competency_volunteer: 90_000,  // α1-2: 학년 묶음 1회 LLM 호출 (~20-40s). 봉사 description 짧음.
  competency_awards: 90_000,     // α1-4-b: 학년 묶음 1회 LLM 호출 (~15-30s). 수상 정보는 봉사보다도 짧음.
  // M1-c W4 hotfix (2026-04-27): 인제고 1학년 첫 풀런 실측 120s 초과. fast tier 응답 변동성 ↑ (rate limit retry 또는 Pro fallback 영향).
  // mainTheme + cascadePlan 2회 LLM 직렬 + 각 withRetry(1s→3s→10s × 3회) 누적 시 충분 여유 필요.
  derive_main_theme: 240_000,
  // M1-c W4 hotfix (2026-04-27): in-runner chunked LLM 호출 (CHUNK_SIZE=6) + cascade prompt 길이 증가.
  // 14 과목 / 6 = 3 chunk × ~60-90s = ~180-270s. Vercel 5분 한계 안전 여유 → 280s.
  setek_guide: 280_000,
  slot_generation: 30_000,
  changche_guide: 240_000,
  haengteuk_guide: 240_000,
  draft_generation: 240_000,  // 세특+창체+행특 가안 순차 생성
  draft_analysis: 280_000,   // 가안 역량 분석 (세특이 가장 오래)
  draft_refinement: 280_000, // P9: score<70 레코드 재생성+재분석 (청크, chunkSize=4)
};

export const PIPELINE_TASK_LABELS: Record<_LegacyKey, string> = {
  competency_analysis: "역량 분석",
  storyline_generation: "스토리라인 감지",
  blueprint_generation: "수렴 설계",
  edge_computation: "연결 분석",
  hyperedge_computation: "통합 테마",
  narrative_arc_extraction: "서사 태깅",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  slot_generation: "슬롯 생성",
  guide_matching: "가이드 매칭",
  haengteuk_linking: "행특 링크",
  gap_tracking: "정합성 분석",
  bypass_analysis: "우회학과 분석",
  setek_guide: "세특 방향",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
  activity_summary: "활동 요약서",
  ai_strategy: "보완전략 제안",
  interview_generation: "면접 질문 생성",
  roadmap_generation: "로드맵 생성",
  tier_plan_refinement: "메인 탐구 개정",
};

/** 태스크별 타임아웃 (ms). 초과 시 failed 전환. */
export const PIPELINE_TASK_TIMEOUTS: Record<_LegacyKey, number> = {
  competency_analysis: 280_000,   // 4분 40초 (다건 배치 — Vercel 5분 제한 내 여유)
  storyline_generation: 120_000,
  blueprint_generation: 120_000,  // Blueprint Phase LLM (standard, ~30-60s)
  edge_computation: 30_000,       // CPU 기반 (5-10s)
  hyperedge_computation: 60_000,  // D-track(2026-04-14): 승격. CPU 기반 (pair-seed union-find, <10s). 여유.
  narrative_arc_extraction: 280_000, // D-track(2026-04-14): 청크 모드 기본. chunkSize=4 × LLM ~10s × 3 concurrency ≈ ~15s/청크.
                                  //   단일 route 최대 280s → chunkSize 크게 주어도 한 청크 내 안전.
  ai_diagnosis: 120_000,          // 2분 (실제 20-30s, 여유 포함)
  course_recommendation: 120_000,
  slot_generation: 30_000,        // 30초 (DB upsert 위주)
  guide_matching: 200_000,        // P2(2026-04-14): Phase A LLM 설계 + design 4건 풀매칭/셸생성 +
                                  //   Phase B fallback이 한 태스크에 묶여 있어 60s 초과. LLM 태스크 수준 상향.
  haengteuk_linking: 150_000,     // A2(2026-04-16): 90s→150s 상향. 인제고 풀런 90s 초과 관찰. Flash × N학년(보통 3회) 여유 포함.
  gap_tracking: 30_000,            // Gap Tracker: 규칙 기반 CPU (<5s)
  bypass_analysis: 120_000,
  // M1-c W3 hotfix (2026-04-27): cascade prompt 길이 증가 대응 (위 GRADE_PIPELINE_TASK_TIMEOUTS 동기).
  setek_guide: 240_000,
  changche_guide: 240_000,
  haengteuk_guide: 240_000,
  activity_summary: 120_000,
  ai_strategy: 120_000,
  interview_generation: 120_000,
  roadmap_generation: 120_000,
  // Phase 4b Sprint 3: Flash → Pro fallback + jaccard 비교 + INSERT. 보통 Flash 성공 ~10-15s.
  tier_plan_refinement: 180_000,
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
// Pipeline-level Cascade (4축×3층, 2026-04-16 D 결정 7)
// ============================================

/**
 * 파이프라인 간 재실행 cascade.
 * 상류 파이프라인 재실행 시 하류도 전체 pending 리셋.
 *
 * 실제 이름은 DB pipeline_type 기준 + mode 구분(grade_analysis vs grade_design):
 *   - grade_analysis: grade 파이프라인 중 mode='analysis' (NEIS 학년)
 *   - grade_design:   grade 파이프라인 중 mode='design' (Prospective 학년)
 */
export type PipelineCascadeKey =
  | "bootstrap"
  | "grade_analysis"
  | "past_analytics"
  | "blueprint"
  | "grade_design"
  | "synthesis";

export const PIPELINE_RERUN_CASCADE: Record<PipelineCascadeKey, PipelineCascadeKey[]> = {
  /** bootstrap 재실행 시 모든 하위 파이프라인 cascade (최상위 진입점) */
  bootstrap: ["past_analytics", "blueprint", "grade_design", "grade_analysis", "synthesis"],
  grade_analysis: ["past_analytics", "blueprint", "grade_design", "synthesis"],
  past_analytics: ["blueprint", "synthesis"],
  blueprint: ["grade_design", "synthesis"],
  grade_design: ["synthesis"],
  synthesis: [],
};

/** 파이프라인 row의 (pipeline_type, mode)로 cascade key 파생. */
export function derivePipelineCascadeKey(
  pipelineType: string,
  mode: "analysis" | "design" | null | undefined,
): PipelineCascadeKey | null {
  if (pipelineType === "bootstrap") {
    return "bootstrap";
  }
  if (pipelineType === "grade") {
    return mode === "design" ? "grade_design" : "grade_analysis";
  }
  if (
    pipelineType === "past_analytics" ||
    pipelineType === "blueprint" ||
    pipelineType === "synthesis"
  ) {
    return pipelineType;
  }
  return null;
}

// ============================================
// Phase → Task Key 매핑 (Phase 순서 검증용)
// ============================================

export const GRADE_PHASE_TASKS: Record<number, _GradeKey[]> = {
  1: ["competency_setek"],
  2: ["competency_changche"],
  3: ["competency_haengteuk"],
  // Phase 4 pre-task: cross_subject_theme_extraction + competency_volunteer + competency_awards + derive_main_theme (직렬 순차)
  // derive_main_theme (M1-c W1, P3.6) — analysisContext + gradeThemes 충족 시점에 capability 호출.
  4: [
    "cross_subject_theme_extraction",
    "competency_volunteer",
    "competency_awards",
    "derive_main_theme",
    "setek_guide",
    "slot_generation",
  ],
  5: ["changche_guide"],
  6: ["haengteuk_guide"],
  7: ["draft_generation"],
  8: ["draft_analysis"],
  9: ["draft_refinement"],   // Phase 5 Sprint 1: IMPROVE 논문 iteration
};

// ============================================
// Pipeline Task Manifest — re-export
// 실체는 `./pipeline-task-manifest.ts`. 한 곳에서 import 가능하도록 여기서도 노출.
// ============================================

export {
  PIPELINE_TASK_MANIFEST,
  PIPELINE_INFRA_TABLES,
  invertReadsResults,
  findWritersOfTable,
  findReadersOfTable,
} from "./pipeline-task-manifest";
export type {
  ManifestTaskKey,
  PipelineTaskManifest,
  PipelineTaskTerminal,
  PipelineTaskTerminalReason,
} from "./pipeline-task-manifest";

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
  3: ["ai_diagnosis", "course_recommendation", "gap_tracking"],
  4: ["bypass_analysis"],
  5: ["activity_summary", "ai_strategy"],
  6: ["interview_generation", "roadmap_generation"],
  // Phase 4b Sprint 3: Synthesis 산출물을 근거로 main_exploration.tier_plan 을 재평가.
  // 수렴(jaccard >= 0.8) 이면 no-op, 미수렴이면 신규 main_exploration row INSERT.
  // 컨설턴트 수정본(edited_by_consultant_at != null) 및 non-bootstrap origin 은 자동 skip.
  7: ["tier_plan_refinement"],
};
