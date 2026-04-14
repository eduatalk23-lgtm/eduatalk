// ============================================
// Pipeline 상수, 타입, 순수 헬퍼 함수
// "use client" 불필요 — 순수 상수/함수
// ============================================

import type {
  GradePipelineTaskKey,
  SynthesisPipelineTaskKey,
} from "@/lib/domains/record-analysis/pipeline/pipeline-types";

// ─── Phase 그룹 정의 ────────────────────────────────────────────────────────

export const GRADE_PHASE_GROUPS: Array<{
  label: string;
  keys: GradePipelineTaskKey[];
}> = [
  { label: "세특 역량", keys: ["competency_setek"] },
  { label: "창체 역량", keys: ["competency_changche"] },
  { label: "행특 역량", keys: ["competency_haengteuk"] },
  { label: "세특+슬롯", keys: ["setek_guide", "slot_generation"] },
  { label: "창체 방향", keys: ["changche_guide"] },
  { label: "행특 방향", keys: ["haengteuk_guide"] },
  { label: "가안 생성", keys: ["draft_generation"] },
  { label: "가안 분석", keys: ["draft_analysis"] },
];

// 3개 섹션으로 분할
export const GRADE_PHASE_GROUP_SECTIONS = [
  {
    title: "역량 분석",
    subtitle: "Phase 1–3",
    phases: GRADE_PHASE_GROUPS.slice(0, 3),
    designOnly: false,
  },
  {
    title: "방향 설정",
    subtitle: "Phase 4–6",
    phases: GRADE_PHASE_GROUPS.slice(3, 6),
    designOnly: false,
  },
  {
    title: "AI 가안",
    subtitle: "Phase 7–8 · 설계 모드 전용",
    phases: GRADE_PHASE_GROUPS.slice(6, 8),
    designOnly: true,
  },
] as const;

export const SYNTHESIS_PHASE_GROUPS: Array<{
  label: string;
  keys: SynthesisPipelineTaskKey[];
}> = [
  { label: "스토리라인", keys: ["storyline_generation"] },
  // 트랙 D: narrative_arc/hyperedge/haengteuk_linking을 정식 task_key로 승격 후
  // Phase 2에 포함. narrative는 클라이언트가 메인 route 진입 전 청크로 선행 처리.
  {
    label: "연결+가이드",
    keys: [
      "narrative_arc_extraction",
      "edge_computation",
      "hyperedge_computation",
      "guide_matching",
      "haengteuk_linking",
    ],
  },
  { label: "진단+추천", keys: ["ai_diagnosis", "course_recommendation"] },
  { label: "우회학과", keys: ["bypass_analysis"] },
  { label: "요약+전략", keys: ["activity_summary", "ai_strategy"] },
  { label: "면접+로드맵", keys: ["interview_generation", "roadmap_generation"] },
];

export const GRADE_TASK_LABEL_MAP: Record<GradePipelineTaskKey, string> = {
  competency_setek: "세특 역량",
  competency_changche: "창체 역량",
  competency_haengteuk: "행특 역량",
  setek_guide: "세특 방향",
  slot_generation: "슬롯 생성",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
  draft_generation: "가안 생성",
  draft_analysis: "가안 분석",
};

export const SYNTH_TASK_LABEL_MAP: Record<SynthesisPipelineTaskKey, string> = {
  storyline_generation: "스토리라인",
  edge_computation: "연결 그래프",
  hyperedge_computation: "통합 테마",
  narrative_arc_extraction: "서사 태깅",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  guide_matching: "가이드 매칭",
  haengteuk_linking: "행특 링크",
  bypass_analysis: "우회학과",
  activity_summary: "활동 요약",
  ai_strategy: "보완 전략",
  interview_generation: "면접 질문",
  roadmap_generation: "로드맵",
};

// ─── Phase 설명 (Tooltip) ───────────────────────────────────────────────────

export const PHASE_DESCRIPTIONS: Record<string, string> = {
  "세특 역량": "교과 세특 기록에서 역량 태그를 추출하고 품질 점수를 산출합니다",
  "창체 역량": "창의적 체험활동 기록에서 역량 태그와 활동 패턴을 분석합니다",
  "행특 역량": "행동특성 및 종합의견에서 인성·사회성 역량을 분석합니다",
  "세특+슬롯": "세특 방향 가이드를 생성하고 교과별 슬롯을 배정합니다",
  "창체 방향": "창체 활동 개선 방향과 연계 전략을 제안합니다",
  "행특 방향": "행동특성 서술 개선 방향을 제안합니다",
  "가안 생성": "방향 가이드 기반으로 AI 초안을 생성합니다 (설계 모드 전용)",
  "가안 분석": "생성된 가안의 역량을 재분석합니다 (설계 모드 전용)",
  "스토리라인": "3개년 활동을 관통하는 성장 스토리라인을 구성합니다",
  "연결+가이드": "레코드 간 연결 그래프를 계산하고 탐구 가이드를 매칭합니다",
  "진단+추천": "종합 진단 리포트를 생성하고 수강 과목을 추천합니다",
  "우회학과": "진로 적합 우회 학과를 탐색합니다",
  "요약+전략": "활동 요약과 보완 전략을 수립합니다",
  "면접+로드맵": "면접 예상 질문과 학기별 로드맵을 생성합니다",
};

// ─── 상태 타입 및 스타일 ─────────────────────────────────────────────────────

export type CellStatus =
  | "locked"
  | "ready"
  | "running"
  | "completed"
  | "cached"
  | "skipped"
  | "failed"
  | "cancelled";

export const STATUS_STYLES: Record<CellStatus, { bg: string; text: string; border: string }> = {
  completed: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  cached: { bg: "bg-teal-50 dark:bg-teal-900/15", text: "text-teal-700 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800" },
  skipped: { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-400 dark:text-gray-500", border: "border-gray-200 dark:border-gray-700" },
  running: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-300 dark:border-indigo-700" },
  failed: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
  ready: { bg: "bg-white dark:bg-gray-900", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-700 hover:border-indigo-400" },
  locked: { bg: "bg-gray-50 dark:bg-gray-900/50", text: "text-gray-400 dark:text-gray-600", border: "border-gray-200 dark:border-gray-800" },
  cancelled: { bg: "bg-amber-50 dark:bg-amber-900/15", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
};

// ─── 순수 헬퍼 함수 ─────────────────────────────────────────────────────────

export function isGradePhaseReady(
  grade: number,
  phase: number,
  gradePipelines: Record<number, { status: string; tasks: Record<string, string> }>,
): boolean {
  const t = gradePipelines[grade]?.tasks ?? {};
  if (phase === 1) {
    if (grade === 1) return true;
    for (let g = 1; g < grade; g++) {
      if (gradePipelines[g]?.status !== "completed") return false;
    }
    return true;
  }
  if (phase === 2) return t.competency_setek === "completed";
  if (phase === 3) return t.competency_changche === "completed";
  if (phase === 4) return t.competency_haengteuk === "completed";
  if (phase === 5) return t.setek_guide === "completed" && t.slot_generation === "completed";
  if (phase === 6) return t.changche_guide === "completed";
  if (phase === 7) return t.haengteuk_guide === "completed";
  if (phase === 8) return t.draft_generation === "completed";
  return false;
}

export function isSynthesisPhaseReady(
  phase: number,
  allGradesCompleted: boolean,
  synth: { tasks: Record<string, string> } | null,
): boolean {
  if (!allGradesCompleted) return false;
  if (!synth) return phase === 1;
  const t = synth.tasks;
  if (phase === 1) return true;
  if (phase === 2) return t.storyline_generation === "completed";
  if (phase === 3) return t.edge_computation === "completed";
  if (phase === 4) return t.ai_diagnosis === "completed" && t.course_recommendation === "completed";
  if (phase === 5) return t.bypass_analysis === "completed";
  if (phase === 6) return t.activity_summary === "completed" && t.ai_strategy === "completed";
  return false;
}

export function deriveCellStatus(
  statuses: string[],
  prereqMet: boolean,
  isCached?: boolean,
  isSkipped?: boolean,
  pipelineStatus?: string,
  options?: {
    /** 현재 학년의 모드 ("analysis" | "design") */
    mode?: "analysis" | "design";
    /** 이 Phase가 설계 모드 전용 섹션(P7/P8)인가 */
    isDesignOnlySection?: boolean;
  },
): CellStatus {
  // 분석 모드 학년의 설계 전용 Phase는 실행 불가 — 항상 skipped ("분석 모드" 라벨)
  // 실제 실행 여부와 무관하게 클릭을 막고 의미 없는 버튼 노출을 차단.
  if (options?.isDesignOnlySection && options.mode === "analysis") {
    return "skipped";
  }
  // 파이프라인 자체가 cancelled면 미완료 셀은 cancelled로 표시
  if (pipelineStatus === "cancelled") {
    if (statuses.every((s) => s === "completed")) {
      if (isSkipped) return "skipped";
      return isCached ? "cached" : "completed";
    }
    return "cancelled";
  }
  if (statuses.some((s) => s === "running")) return "running";
  if (statuses.every((s) => s === "completed")) {
    if (isSkipped) return "skipped";
    return isCached ? "cached" : "completed";
  }
  if (statuses.some((s) => s === "failed")) return "failed";
  if (prereqMet) return "ready";
  return "locked";
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}
