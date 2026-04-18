// ============================================
// Pipeline Task Manifest (2026-04-17 PR 1)
//
// 각 파이프라인 태스크의 DB writes / reads / readsResults / terminal 선언.
// CI 검증 스크립트(`scripts/validate-pipeline-manifest.ts`, PR 2)가 AST 기반으로
// 실 코드의 `.from("X")`·`ctx.results[...]` 호출과 이 매니페스트를 대조하여
// drift / orphan 테이블을 탐지한다.
//
// ⚠️ 태스크 runner를 수정할 때 반드시 여기도 함께 갱신할 것.
//    CI가 실패하면 "매니페스트와 실 코드가 어긋났다"는 신호.
//
// client-safe (no server imports). pipeline-config.ts / pipeline-types.ts 와 동일 레벨.
// ============================================

import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
} from "./pipeline-config";

type _GradeKey = (typeof GRADE_PIPELINE_TASK_KEYS)[number];
type _SynthKey = (typeof SYNTHESIS_PIPELINE_TASK_KEYS)[number];
type _PastKey = (typeof PAST_ANALYTICS_TASK_KEYS)[number];
type _BlueprintKey = (typeof BLUEPRINT_TASK_KEYS)[number];

/** 4종 파이프라인 전체 태스크 키(매니페스트 대상). legacy `PIPELINE_TASK_KEYS`는 제외. */
export type ManifestTaskKey = _GradeKey | _SynthKey | _PastKey | _BlueprintKey;

/**
 * 파이프라인 내 소비자가 없는 태스크의 사유.
 *
 * - `ui_only`         : UI 화면에서만 소비 (탭/카드/다운로드).
 * - `external_tool`   : 다른 도메인의 파이프라인/도구에서 소비 (예: bypass_major).
 * - `cross_run_feedback` : 다음 실행의 상류 태스크가 참조 (PipelineContext.previousRunOutputs 인프라 필요).
 */
export type PipelineTaskTerminalReason =
  | "ui_only"
  | "external_tool"
  | "cross_run_feedback";

export interface PipelineTaskTerminal {
  /** 왜 파이프라인 내 소비자가 없는지. */
  reason: PipelineTaskTerminalReason;
  /** UI 경로·외부 도구·다음 실행 경로 등 실제 소비 지점 (2개 이상 권장). */
  consumers: readonly string[];
  /**
   * 임시 terminal 플래그 — PR 5(cross_run_feedback 인프라) 완성 시 해제 대상.
   * `true` 면 "현 시점 소비자 없음"이 아니라 "다음 실행 피드백 인프라 대기 중" 의미.
   *
   * 2026-04-17 분기점 ① 결정: `ui_only` 전원 임시 선언 — 영구 선언하면
   * PR 5 피드백 후보에서 영구 제외되어 같은 deprioritize 패턴이 재발한다.
   */
  pendingCrossRunFeedback?: boolean;
}

export interface PipelineTaskManifest {
  /** INSERT/UPSERT/DELETE 대상 도메인 테이블 (파이프라인 인프라 테이블 제외). */
  writes: readonly string[];
  /** SELECT 대상 테이블 (같은 실행 내 재조회 포함). */
  reads: readonly string[];
  /** `ctx.results[taskKey]` 또는 `ctx.{field}` (upstream 산출물) 소비. */
  readsResults: readonly ManifestTaskKey[];
  /**
   * 파이프라인 내 다른 태스크의 `reads` / `readsResults` 로 흘러들어가지 않는 경우에만 선언.
   * CI가 orphan 탐지 시 terminal 미선언이면 실패시킨다.
   */
  terminal?: PipelineTaskTerminal;
  /**
   * PR 5 (2026-04-17): Cross-run feedback 경로.
   * 이 태스크의 산출물이 **다음 실행** 어느 상류 태스크에 공급되는지 선언.
   * terminal.pendingCrossRunFeedback=true 인 태스크는 반드시 비어있지 않아야 한다(CI 검증).
   *
   * 소비 측 태스크는 `ctx.previousRunOutputs.taskResults[<thisTaskKey>]` 또는
   * `readsFromPreviousRun` 로 선언한 테이블을 쿼리해 읽는다.
   */
  writesForNextRun?: readonly ManifestTaskKey[];
  /**
   * PR 5: Cross-run 테이블 읽기 전용 선언.
   * `reads` 는 "같은 실행 내 소비" 의미이므로 orphan 판정에 참여하지만,
   * `readsFromPreviousRun` 은 "직전 실행의 잔존 데이터를 힌트로 읽음" 의미 — orphan 검사 대상 아님.
   *
   * 코드의 `.from("X")` 는 reads + readsFromPreviousRun 합집합에 있으면 통과.
   */
  readsFromPreviousRun?: readonly string[];
}

/**
 * 파이프라인 인프라 테이블 — 모든 태스크가 공통으로 기록/조회하므로 writes/reads에서 제외.
 * CI 스크립트가 이 목록을 무시하고 domain write/read만 대조한다.
 */
export const PIPELINE_INFRA_TABLES: readonly string[] = [
  "student_record_analysis_pipelines",
  "student_record_analysis_cache",
] as const;

// ============================================
// PIPELINE_TASK_MANIFEST
// 28 태스크 = Grade 10 + Synthesis 14 + Past 3 + Blueprint 1.
// ============================================

export const PIPELINE_TASK_MANIFEST: Record<ManifestTaskKey, PipelineTaskManifest> = {
  // ── Grade Pipeline (10) ────────────────────
  competency_setek: {
    writes: [
      "student_record_activity_tags",
      "student_record_content_quality",
      "student_record_profile_cards",
    ],
    reads: [
      "student_record_seteks",
      "student_record_activity_tags",
      "student_record_profile_cards",
      "student_record_competency_scores",
      "student_record_content_quality",
    ],
    readsResults: [],
  },

  competency_changche: {
    writes: [
      "student_record_activity_tags",
      "student_record_content_quality",
    ],
    reads: [
      "student_record_changche",
      "student_record_profile_cards",
    ],
    readsResults: ["competency_setek"],
  },

  competency_haengteuk: {
    writes: [
      "student_record_activity_tags",
      "student_record_content_quality",
      "student_record_competency_scores",
    ],
    reads: [
      "student_record_haengteuk",
      "student_record_profile_cards",
      "student_record_activity_tags",
      "student_record_competency_scores",
    ],
    readsResults: ["competency_setek", "competency_changche"],
  },

  cross_subject_theme_extraction: {
    writes: [],
    reads: [
      "student_record_seteks",
      "student_record_changche",
    ],
    readsResults: [
      "competency_setek",
      "competency_changche",
      "competency_haengteuk",
    ],
  },

  setek_guide: {
    writes: ["student_record_setek_guides"],
    reads: [
      "student_record_diagnosis",
      "student_record_storylines",
      "student_record_competency_scores",
      "student_record_content_quality",
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "subjects",
      "exploration_guides",
      "exploration_guide_assignments",
    ],
    readsResults: [
      "competency_setek",
      "competency_haengteuk",
      "cross_subject_theme_extraction",
    ],
  },

  slot_generation: {
    writes: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
    ],
    reads: ["student_course_plans"],
    readsResults: [],
  },

  changche_guide: {
    writes: ["student_record_changche_guides"],
    reads: [
      "student_record_diagnosis",
      "student_record_storylines",
      "student_record_competency_scores",
      "student_record_content_quality",
      "student_record_setek_guides",
    ],
    readsResults: [
      "competency_changche",
      "setek_guide",
      "cross_subject_theme_extraction",
    ],
  },

  haengteuk_guide: {
    writes: ["student_record_haengteuk_guides"],
    reads: [
      "student_record_diagnosis",
      "student_record_storylines",
      "student_record_competency_scores",
      "student_record_content_quality",
      "student_record_changche_guides",
    ],
    readsResults: [
      "competency_haengteuk",
      "changche_guide",
      "cross_subject_theme_extraction",
    ],
  },

  draft_generation: {
    writes: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
    ],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "student_record_setek_guides",
      "student_record_changche_guides",
      "student_record_haengteuk_guides",
      "subjects",
    ],
    readsResults: [
      "setek_guide",
      "changche_guide",
      "haengteuk_guide",
      "blueprint_generation",
    ],
  },

  draft_analysis: {
    writes: [
      "student_record_activity_tags",
      "student_record_content_quality",
      "student_record_competency_scores",
      "student_record_edges",
    ],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "student_record_content_quality",
      "subjects",
    ],
    readsResults: ["draft_generation"],
  },

  // ── Synthesis Pipeline (14) ────────────────
  storyline_generation: {
    writes: [
      "student_record_storylines",
      "student_record_storyline_links",
    ],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_storylines",
      "student_record_storyline_links",
      "student_course_plans",
    ],
    readsResults: [],
    // PR 5 POC: 이전 실행 activity_summary 제목을 연속성 힌트로 읽는다.
    readsFromPreviousRun: ["student_record_activity_summaries"],
  },

  edge_computation: {
    writes: [
      "student_record_edges",
      "student_record_narrative_arc",
      "student_record_topic_trajectories",
      "student_record_hyperedges",
    ],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "student_record_competency_scores",
      "student_record_storylines",
      "student_record_topic_trajectories",
      "student_record_narrative_arc",
      "student_record_hyperedges",
      "student_record_profile_cards",
      "exploration_guides",
      "exploration_guide_assignments",
      "exploration_guide_subject_mappings",
      "exploration_guide_career_mappings",
      "exploration_guide_sequels",
      "student_main_explorations",
      "student_course_plans",
      "student_internal_scores",
      "school_profiles",
      "school_offered_subjects",
      "subjects",
    ],
    readsResults: ["storyline_generation"],
  },

  hyperedge_computation: {
    writes: ["student_record_hyperedges"],
    reads: ["student_record_edges"],
    readsResults: ["edge_computation"],
  },

  narrative_arc_extraction: {
    writes: ["student_record_narrative_arc"],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "student_record_personal_seteks",
      "student_record_narrative_arc",
    ],
    readsResults: ["storyline_generation"],
  },

  guide_matching: {
    writes: [
      "exploration_guide_assignments",
      "exploration_guides",
      "exploration_guide_subject_mappings",
    ],
    reads: [
      "student_record_storylines",
      "student_record_setek_guides",
      "student_record_changche_guides",
      "student_record_haengteuk_guides",
      "student_record_hyperedges", // PR 4: blueprint + analysis context 병합 조회
      "student_record_narrative_arc",
      "student_record_profile_cards",
      "exploration_guides",
      "exploration_guide_assignments",
      "exploration_guide_career_mappings",
      "exploration_guide_sequels",
      "student_course_plans",
      "subjects",
      "student_main_explorations",
      "student_record_topic_trajectories",
    ],
    // PR 4 (2026-04-17): blueprint_generation 추가 —
    // applyContinuityRanking 의 hyperedge context 확장 + storylineKeywords 4차 fallback +
    // runExplorationDesign 프롬프트 blueprintConvergences 주입.
    readsResults: [
      "storyline_generation",
      "edge_computation",
      "hyperedge_computation",
      "narrative_arc_extraction",
      "blueprint_generation",
    ],
  },

  haengteuk_linking: {
    writes: ["student_record_haengteuk_guide_links"],
    reads: [
      "student_record_haengteuk_guides",
      "exploration_guide_assignments",
      "student_record_haengteuk_guide_links",
    ],
    readsResults: ["guide_matching", "haengteuk_guide"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "admin 생기부 탭 → 행특 평가항목 카드 링크 배지",
        "학생/학부모 탭 → 행특 연계 활동 뷰",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5: 이전 실행 행특 링크 분포 → 다음 실행 guide_matching 중복 배정 회피/연속성 신호.
    writesForNextRun: ["guide_matching"],
  },

  ai_diagnosis: {
    writes: [
      "student_record_diagnosis",
      "student_record_edges",
    ],
    reads: [
      "student_record_competency_scores",
      "student_record_content_quality",
      "student_record_diagnosis",
      "student_internal_scores",
      "students",
      "student_record_storylines",
      "student_record_edges",
    ],
    readsResults: [
      "edge_computation",
      "storyline_generation",
      "cross_subject_theme_extraction",
    ],
  },

  course_recommendation: {
    writes: [],
    reads: ["student_internal_scores", "students"],
    readsResults: ["ai_diagnosis"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "diagnosis 탭 과목 추천 카드",
        "학생 추천 과목 슬롯 표시",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5: 이전 실행 추천 과목 → 다음 실행 ai_diagnosis 의 "수강 궤적" 맥락 보강.
    writesForNextRun: ["ai_diagnosis"],
  },

  gap_tracking: {
    writes: ["student_record_hyperedges"],
    reads: [
      "student_record_hyperedges",
      "student_record_competency_scores",
    ],
    readsResults: ["ai_diagnosis", "blueprint_generation"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "진단 탭 정합성 지표 카드(coverage/coherence)",
        "bridge 하이퍼엣지 전용 뷰",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5: 이전 실행 bridge/격차 → 다음 실행 ai_strategy 가 "지난번에 미해결된 gap 우선 공략" 맥락 확보.
    writesForNextRun: ["ai_strategy"],
  },

  bypass_analysis: {
    writes: [],
    reads: ["student_record_diagnosis"],
    readsResults: ["ai_diagnosis"],
    terminal: {
      reason: "external_tool",
      consumers: [
        "lib/domains/bypass-major/pipeline.ts (runBypassPipeline)",
        "lib/domains/admission/placement/auto-placement.ts (autoRunPlacement)",
      ],
    },
  },

  activity_summary: {
    writes: ["student_record_activity_summaries"],
    reads: [
      "student_record_activity_summaries",
      "student_record_diagnosis",
      "student_record_setek_guides",
      "student_record_changche_guides",
      "subjects",
      "course_plans",
      "exploration_guide_assignments",
    ],
    readsResults: ["edge_computation", "guide_matching"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "활동 요약서 탭 (admin)",
        "PDF export 파이프라인",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5 POC: 이전 실행 활동 요약(제목/핵심 키워드) → 다음 실행 storyline_generation 연속성 힌트.
    writesForNextRun: ["storyline_generation"],
  },

  ai_strategy: {
    writes: ["student_record_strategies"],
    reads: [
      "student_record_diagnosis",
      "student_record_competency_scores",
      "student_record_strategies",
      "student_record_content_quality",
      "student_record_seteks",
      "student_record_hyperedges",
      "subjects",
    ],
    readsResults: [
      "ai_diagnosis",
      "hyperedge_computation",
      "gap_tracking",
    ],
  },

  interview_generation: {
    writes: ["student_record_interview_questions"],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_content_quality",
      "student_record_applications",
      "university_evaluation_criteria",
      "student_record_interview_questions",
    ],
    readsResults: ["ai_diagnosis", "ai_strategy"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "면접 예상질문 탭",
        "학생 면접 준비 모드",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5: 이전 실행 면접 질문 → 다음 실행 activity_summary 가 "질문이 많이 나왔던 활동" 을 우선 요약.
    writesForNextRun: ["activity_summary"],
  },

  roadmap_generation: {
    writes: ["student_record_roadmap_items"],
    reads: [
      "students",
      "student_record_seteks",
      "student_course_plans",
      "student_record_storylines",
      "student_snapshots",
      "admission_exemplars",
      "student_record_setek_guides",
      "student_record_diagnosis",
      "student_record_roadmap_items",
    ],
    readsResults: ["ai_diagnosis"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "로드맵 탭 (학기별 미션)",
        "학부모 리포트 요약",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5: 이전 실행 로드맵 item 들 → 다음 실행 storyline_generation 의 "과거 계획 대비 진척" 서사 힌트.
    writesForNextRun: ["storyline_generation"],
  },

  // ── Past Analytics (3) ─────────────────────
  past_storyline_generation: {
    writes: [
      "student_record_storylines",
      "student_record_storyline_links",
    ],
    reads: [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "student_record_storylines",
    ],
    readsResults: [],
  },

  past_diagnosis: {
    writes: ["student_record_diagnosis"],
    reads: [
      "student_snapshots",
      "student_record_competency_scores",
      "student_record_content_quality",
      "student_record_storylines",
    ],
    readsResults: ["past_storyline_generation"],
  },

  past_strategy: {
    writes: ["student_record_strategies"],
    reads: ["student_record_diagnosis"],
    readsResults: ["past_diagnosis"],
    terminal: {
      reason: "ui_only",
      consumers: [
        "Past Analytics 대시보드 → 즉시 행동 권고 카드",
        "학부모 리포트 현재 행동 섹션",
      ],
      pendingCrossRunFeedback: true,
    },
    // PR 5: 이전 실행 과거 전략 → 다음 실행 past_diagnosis 가 "전 번 권고 이행도" 맥락 반영.
    writesForNextRun: ["past_diagnosis"],
  },

  // ── Blueprint (1) ─────────────────────────
  blueprint_generation: {
    writes: ["student_record_hyperedges"],
    reads: [
      "students",
      "student_course_plans",
      "student_record_storylines",
      "student_snapshots",
      "admission_exemplars",
      "student_main_explorations",
    ],
    readsResults: [],
    // blueprint 하이퍼엣지(context='blueprint')는 gap_tracking + draft_generation 에서 소비.
    // PR 4 에서 setek_guide / cross_subject_theme_extraction 소비 경로 추가 예정.
    // Cross-run self-loop: 직전 실행 convergences 를 연속성 힌트로 주입 — theme 완전 교체 방지.
    writesForNextRun: ["blueprint_generation"],
  },
};

// ============================================
// 유틸리티 (CI 검증 스크립트와 공유)
// ============================================

/**
 * `readsResults` 역산 → `writesResultsFor`(downstream task 목록).
 * upstream task 가 ctx 산출물을 누구에게 공급하는지 파악할 때 사용.
 */
export function invertReadsResults(): Record<ManifestTaskKey, ManifestTaskKey[]> {
  const result: Partial<Record<ManifestTaskKey, ManifestTaskKey[]>> = {};
  for (const key of Object.keys(PIPELINE_TASK_MANIFEST) as ManifestTaskKey[]) {
    result[key] = [];
  }
  for (const [downstream, manifest] of Object.entries(PIPELINE_TASK_MANIFEST) as [
    ManifestTaskKey,
    PipelineTaskManifest,
  ][]) {
    for (const upstream of manifest.readsResults) {
      result[upstream]!.push(downstream);
    }
  }
  return result as Record<ManifestTaskKey, ManifestTaskKey[]>;
}

/**
 * 특정 테이블을 쓰는 태스크 목록. CI orphan 탐지 보조.
 */
export function findWritersOfTable(table: string): ManifestTaskKey[] {
  const writers: ManifestTaskKey[] = [];
  for (const [key, manifest] of Object.entries(PIPELINE_TASK_MANIFEST) as [
    ManifestTaskKey,
    PipelineTaskManifest,
  ][]) {
    if (manifest.writes.includes(table)) writers.push(key);
  }
  return writers;
}

/**
 * 특정 테이블을 읽는 태스크 목록. CI orphan 탐지 보조.
 */
export function findReadersOfTable(table: string): ManifestTaskKey[] {
  const readers: ManifestTaskKey[] = [];
  for (const [key, manifest] of Object.entries(PIPELINE_TASK_MANIFEST) as [
    ManifestTaskKey,
    PipelineTaskManifest,
  ][]) {
    if (manifest.reads.includes(table)) readers.push(key);
  }
  return readers;
}
