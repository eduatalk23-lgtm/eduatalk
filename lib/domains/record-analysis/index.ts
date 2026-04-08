// ============================================
// Record Analysis Domain — Public API barrel
//
// AI 분석 파이프라인, LLM 액션, 평가 모듈의 진입점.
// client-safe exports: pipeline-config, pipeline-types만.
// 나머지는 server-only.
// ============================================

// Pipeline (server-only barrel — 클라이언트에서는 pipeline-config.ts, pipeline-types.ts 직접 import)
export * from "./pipeline";

// Eval (완전 독립, server-only)
export * from "./eval/executive-summary-evaluator";
export * from "./eval/golden-dataset-evaluator";
export * from "./eval/highlight-verifier";
export * from "./eval/timeseries-analyzer";
export * from "./eval/university-profile-matcher";
