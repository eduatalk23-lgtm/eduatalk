// ============================================
// AI 초기 분석 파이프라인 타입
// Phase B: DB 상태 추적 + 3초 폴링
// 7개 태스크 순차 실행 (의존성 순서)
// ============================================

export type PipelineOverallStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type PipelineTaskStatus = "pending" | "running" | "completed" | "failed";

export const PIPELINE_TASK_KEYS = [
  "competency_analysis",     // 1st: 역량 태그 + 등급 생성
  "ai_diagnosis",            // 2nd: 역량 결과 → 종합진단(강점/약점)
  "storyline_generation",    // 3rd: 기록 분석 → 스토리라인 감지
  "course_recommendation",   // 4th: 수강 추천 (독립)
  "guide_matching",          // 5th: 가이드 배정 (독립)
  "setek_guide",             // 6th: 역량+진단+스토리라인 활용
  "activity_summary",        // 7th: 스토리라인 활용
] as const;

export type PipelineTaskKey = (typeof PIPELINE_TASK_KEYS)[number];

export const PIPELINE_TASK_LABELS: Record<PipelineTaskKey, string> = {
  competency_analysis: "역량 분석",
  ai_diagnosis: "종합 진단",
  storyline_generation: "스토리라인 감지",
  course_recommendation: "수강 추천",
  guide_matching: "가이드 매칭",
  setek_guide: "세특 방향",
  activity_summary: "활동 요약서",
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
