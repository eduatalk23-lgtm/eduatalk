// ============================================
// Synthesis 파이프라인 — Public API
// 기존 pipeline-task-runners-synthesis.ts 에서 분리된 모든 함수를 re-export
// ============================================

// S1
export { runStorylineGeneration } from "./phase-s1-storyline";

// S1.5 Blueprint는 독립 blueprint 파이프라인으로 분리됨 (2026-04-16 D).
// 기존 import 경로 호환은 `../blueprint` 및 `pipeline-task-runners` aggregator가 제공.

// S2
export { runEdgeComputation } from "./phase-s2-edges";
export { runGuideMatching } from "./phase-s2-guide-match";
export { runHaengteukGuideLinking, runHaengteukGuideLinkingChunk } from "./phase-s2-haengteuk-linking";
export { runHyperedgeComputation } from "./phase-s2-hyperedges";
export { runNarrativeArcExtraction } from "./phase-s2-narrative-arc";

// S3
export { runAiDiagnosis, runCourseRecommendation } from "./phase-s3-diagnosis";

// S3.5
export { runGapTracking } from "./phase-s3p5-gap-tracker";

// S4
export { runBypassAnalysis } from "./phase-s4-bypass";

// S5
export { runActivitySummary, runActivitySummaryForGrade, runAiStrategy } from "./phase-s5-strategy";

// S6
export { runInterviewGeneration, runRoadmapGeneration } from "./phase-s6-interview";

// S7 (Phase 4b Sprint 3): Synthesis → main_exploration 피드백 루프
export { runTierPlanRefinement } from "./phase-s7-tier-plan-refinement";
