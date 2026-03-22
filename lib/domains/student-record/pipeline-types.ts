// ============================================
// AI 초기 분석 파이프라인 타입
// Phase B: DB 상태 추적 + 3초 폴링
// ============================================

export type PipelineOverallStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PipelineTaskStatus = "pending" | "running" | "completed" | "failed";

export const PIPELINE_TASK_KEYS = [
  "course_recommendation",
  "guide_matching",
  "setek_guide",
  "activity_summary",
  "competency_analysis",
] as const;

export type PipelineTaskKey = (typeof PIPELINE_TASK_KEYS)[number];

export const PIPELINE_TASK_LABELS: Record<PipelineTaskKey, string> = {
  course_recommendation: "수강 추천",
  guide_matching: "가이드 매칭",
  setek_guide: "세특 방향",
  activity_summary: "활동 요약서",
  competency_analysis: "역량 분석",
};

export interface PipelineStatus {
  id: string;
  studentId: string;
  status: PipelineOverallStatus;
  tasks: Record<PipelineTaskKey, PipelineTaskStatus>;
  taskPreviews: Record<string, string>;
  errorDetails: Record<string, string> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
