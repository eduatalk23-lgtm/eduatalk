// ============================================
// pipeline-orchestrator 공유 타입
// ============================================

export interface GradeAwarePipelineStartResult {
  /** 학년 → pipelineId 매핑 */
  gradePipelines: Array<{ grade: number; pipelineId: string; status: string }>;
  /** 클라이언트가 즉시 실행해야 할 첫 번째 grade 파이프라인 ID */
  firstPipelineId: string | null;
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
  synthesisPipeline: {
    pipelineId: string;
    status: string;
    tasks: Record<string, string>;
    previews: Record<string, string>;
    elapsed: Record<string, number>;
    errors: Record<string, string>;
  } | null;
  /** 파이프라인 실행 전에도 NEIS 유무 기반으로 예상 mode를 표시 (1~3학년) */
  expectedModes: Record<number, "analysis" | "design">;
}
