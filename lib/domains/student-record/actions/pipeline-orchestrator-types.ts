// ============================================
// pipeline-orchestrator 공유 타입
// ============================================

export interface GradeAwarePipelineStartResult {
  /** 학년 → pipelineId 매핑 */
  gradePipelines: Array<{ grade: number; pipelineId: string; status: string }>;
  /** 클라이언트가 즉시 실행해야 할 첫 번째 grade 파이프라인 ID */
  firstPipelineId: string | null;
}

/**
 * 단일 파이프라인 상태 (grade 외 공통).
 * synthesis/past_analytics/blueprint가 동일 구조를 공유한다.
 */
export interface SinglePipelineStatus {
  pipelineId: string;
  status: string;
  tasks: Record<string, string>;
  previews: Record<string, string>;
  elapsed: Record<string, number>;
  errors: Record<string, string>;
}

export interface GradeAwarePipelineStatus {
  gradePipelines: Record<
    number,
    {
      pipelineId: string;
      grade: number;
      status: string;
      mode: "analysis" | "design";
      tasks: Record<string, string>;
      previews: Record<string, string>;
      elapsed: Record<string, number>;
      errors: Record<string, string>;
    }
  >;
  synthesisPipeline: SinglePipelineStatus | null;
  /** 4축×3층 A층 — NEIS 학년이 있을 때만 생성 (k≥1) */
  pastAnalyticsPipeline: SinglePipelineStatus | null;
  /** 4축×3층 B층 — 설계 대상 학년이 있을 때만 생성 (k<3) */
  blueprintPipeline: SinglePipelineStatus | null;
  /** Auto-Bootstrap Phase 0 — target_major 진입 자동 셋업 (main_exploration + course_plan) */
  bootstrapPipeline: SinglePipelineStatus | null;
  /** 파이프라인 실행 전에도 NEIS 유무 기반으로 예상 mode를 표시 (1~3학년) */
  expectedModes: Record<number, "analysis" | "design">;
}
