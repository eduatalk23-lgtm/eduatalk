// ============================================
// AI 초기 분석 파이프라인 타입
// Phase B+E1+F3: DB 상태 추적 + 3초 폴링
// 9개 태스크 순차 실행 (의존성 순서)
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
  "setek_guide",             // 7th: 진단+엣지 → 세특 방향
  "activity_summary",        // 8th: 스토리라인+엣지 → 활동 요약서
  "ai_strategy",             // 9th: 진단 약점+부족역량 → 보완전략 자동 제안
] as const;

export type PipelineTaskKey = (typeof PIPELINE_TASK_KEYS)[number];

export const PIPELINE_TASK_LABELS: Record<PipelineTaskKey, string> = {
  competency_analysis: "역량 분석",
  storyline_generation: "스토리라인 감지",
  edge_computation: "연결 분석",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  guide_matching: "가이드 매칭",
  setek_guide: "세특 방향",
  activity_summary: "활동 요약서",
  ai_strategy: "보완전략 제안",
};

export interface PipelineStatus {
  id: string;
  studentId: string;
  status: PipelineOverallStatus;
  tasks: Record<PipelineTaskKey, PipelineTaskStatus>;
  taskPreviews: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taskResults: Record<string, any>;
  errorDetails: Record<string, string> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  contentHash?: string | null;
}
