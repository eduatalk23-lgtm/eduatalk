// ============================================
// AI 초기 분석 파이프라인 타입
// Phase B+E1+F3: DB 상태 추적 + 3초 폴링
// 3-Phase 병렬 실행 (12 태스크):
//   Phase 1 (순차): 역량→스토리라인→엣지→가이드배정
//   Phase 2 (병렬): 진단, 수강, 우회학과
//   Phase 3 (병렬, 진단 후): 세특방향, 보완전략, 면접질문, 요약서, 로드맵
// ============================================

export type PipelineOverallStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PipelineTaskStatus = "pending" | "running" | "completed" | "failed";

export const PIPELINE_TASK_KEYS = [
  "competency_analysis",     // 1st: 역량 태그 + 등급 생성
  "storyline_generation",    // 2nd: 기록 분석 → 스토리라인 감지 (진단보다 먼저)
  "edge_computation",        // 3rd: 태그+스토리라인 → 7종 엣지 영속화
  "ai_diagnosis",            // 4th: 역량+엣지 → 종합진단(강점/약점)
  "course_recommendation",   // 5th: 수강 추천 (독립)
  "guide_matching",          // 6th: 가이드 배정 (독립)
  "bypass_analysis",         // 7th: 우회학과 분석 (독립, Phase 2)
  "setek_guide",             // 8th: 진단+엣지 → 세특 방향
  "activity_summary",        // 9th: 스토리라인+엣지 → 활동 요약서
  "ai_strategy",             // 10th: 진단 약점+부족역량 → 보완전략 자동 제안
  "interview_generation",    // 11th: 기록+진단 → 면접 예상 질문 생성
  "roadmap_generation",      // 12th: 진단+스토리라인+세특방향 → 학기별 로드맵
] as const;

export type PipelineTaskKey = (typeof PIPELINE_TASK_KEYS)[number];

export const PIPELINE_TASK_LABELS: Record<PipelineTaskKey, string> = {
  competency_analysis: "역량 분석",
  storyline_generation: "스토리라인 감지",
  edge_computation: "연결 분석",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  guide_matching: "가이드 매칭",
  bypass_analysis: "우회학과 분석",
  setek_guide: "세특 방향",
  activity_summary: "활동 요약서",
  ai_strategy: "보완전략 제안",
  interview_generation: "면접 질문 생성",
  roadmap_generation: "로드맵 생성",
};

export interface PipelineStatus {
  id: string;
  studentId: string;
  status: PipelineOverallStatus;
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
// 파이프라인 내부 타입 (pipeline.ts 전용)
// ============================================

/** taskResults 타입 (JSON-serializable) */
export type PipelineTaskResults = Record<string, unknown>;

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
  grade: number;
  subject: { name: string } | null;
}

/** 캐시된 창체 쿼리 결과 */
export interface CachedChangche {
  id: string;
  content: string;
  grade: number;
  activity_type: string | null;
}

/** 캐시된 행특 쿼리 결과 */
export interface CachedHaengteuk {
  id: string;
  content: string;
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
export const PIPELINE_TASK_DEPENDENTS: Partial<Record<PipelineTaskKey, PipelineTaskKey[]>> = {
  competency_analysis: ["storyline_generation", "edge_computation", "guide_matching", "ai_diagnosis", "setek_guide", "activity_summary", "ai_strategy", "interview_generation", "roadmap_generation"],
  storyline_generation: ["edge_computation", "guide_matching", "ai_diagnosis", "setek_guide", "activity_summary", "roadmap_generation"],
  edge_computation: ["ai_diagnosis", "setek_guide", "activity_summary"],
  guide_matching: ["setek_guide", "activity_summary", "roadmap_generation"],
  ai_diagnosis: ["setek_guide", "ai_strategy", "interview_generation", "roadmap_generation"],
  setek_guide: ["roadmap_generation"],
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
