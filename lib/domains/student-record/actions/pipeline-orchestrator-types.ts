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

/**
 * AI 가이드 본문 생성 진행률 (P0-2).
 *
 * synthesis 의 setek_guide / changche_guide / haengteuk_guide task 가 메타 row 까지만
 * 생성하고 종료된 뒤, 본문은 ai-guide-gen 라우트가 background 로 1건씩 채운다.
 * 따라서 task='completed' 가 곧 "사용자가 볼 본문 완성" 을 의미하지 않는다 — UI 가
 * "가이드 본문: N/M 완성" 식으로 추가 표시할 수 있도록 본 집계를 같이 내려준다.
 */
export interface AiGuideProgress {
  /** ai_pipeline_design + is_latest 가이드 총합 (해당 학생) */
  total: number;
  /** 본문 완성 — 검토 대기 또는 승인 */
  completed: number;
  /** 본문 생성 대기 (queued_generation) */
  queued: number;
  /** 본문 생성 중 (ai_generating) */
  generating: number;
  /** 본문 생성 실패 (ai_failed) */
  failed: number;
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
  /** 가이드 본문 생성 진행률 — synthesisPipeline 존재 시에만 채워짐 */
  aiGuideProgress: AiGuideProgress | null;
}
