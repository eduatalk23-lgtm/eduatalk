// ============================================
// Synthesis 파이프라인 — Public API
// 기존 pipeline-task-runners-synthesis.ts 에서 분리된 모든 함수를 re-export
// ============================================

// S1
export { runStorylineGeneration } from "./phase-s1-storyline";

// S2
export { runEdgeComputation, runGuideMatching } from "./phase-s2-edges";
export { runHaengteukGuideLinking } from "./phase-s2-haengteuk-linking";
export { runHyperedgeComputation } from "./phase-s2-hyperedges";
export { runNarrativeArcExtraction } from "./phase-s2-narrative-arc";

// S3
export { runAiDiagnosis, runCourseRecommendation } from "./phase-s3-diagnosis";

// S4
export { runBypassAnalysis } from "./phase-s4-bypass";

// S5
export { runActivitySummary, runAiStrategy } from "./phase-s5-strategy";

// S6
export { runInterviewGeneration, runRoadmapGeneration } from "./phase-s6-interview";
