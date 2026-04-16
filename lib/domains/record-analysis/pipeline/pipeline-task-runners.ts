// ============================================
// AI 파이프라인 태스크 러너 — 진입점 (re-export + 공용 헬퍼)
//
// 기존 import 경로 호환을 위해 모든 exported 함수를 이 파일에서 re-export한다.
// 각 함수의 실제 구현은 하위 모듈에 있음:
//   - pipeline-task-runners-shared.ts   : 공용 헬퍼 (runWithConcurrency, collectAnalysisContext 등)
//   - pipeline-task-runners-guide.ts     : 가이드 생성 태스크 (P4-P6 + slot + ForGrade 변형 G2-G4)
//   - pipeline-task-runners-competency.ts: 역량 분석 태스크 (P1-P3 + G1 ForGrade 변형)
//   - pipeline-task-runners-slot.ts      : 슬롯 생성 태스크 (G5 ForGrade 변형)
// ============================================

// 공용 헬퍼 (일부 외부에서 직접 사용)
export {
  runWithConcurrency,
  collectAnalysisContext,
  toGuideAnalysisContext,
  mergeGuideAnalysisContexts,
  buildGuideAnalysisContextFromReport,
} from "./pipeline-task-runners-shared";

// Synthesis Pipeline (S1-S6 + S3.5 Gap Tracker)
// Note: Blueprint는 2026-04-16 D 에서 독립 blueprint 파이프라인으로 분리됨.
export {
  runStorylineGeneration,
  runEdgeComputation,
  runAiDiagnosis,
  runCourseRecommendation,
  runGapTracking,
  runGuideMatching,
  runHaengteukGuideLinking,
  runHyperedgeComputation,
  runNarrativeArcExtraction,
  runActivitySummary,
  runAiStrategy,
  runBypassAnalysis,
  runInterviewGeneration,
  runRoadmapGeneration,
} from "./synthesis";

// Blueprint Pipeline (B1, 2026-04-16 D)
export { runBlueprintGeneration } from "./blueprint";

// Guide Pipeline (P4-P6 + slot + ForGrade 변형 G2-G4)
export {
  runSetekGuide,
  runChangcheGuide,
  runHaengteukGuide,
  runSlotGeneration,
  runSetekGuideForGrade,
  runChangcheGuideForGrade,
  runHaengteukGuideForGrade,
} from "./pipeline-task-runners-guide";

// Slot Pipeline — Grade 변형 (G5)
export { runSlotGenerationForGrade } from "./pipeline-task-runners-slot";

// Competency Pipeline — Grade 변형 (P1-P3 ForGrade)
export {
  runCompetencySetekForGrade,
  runCompetencySetekChunkForGrade,
  runCompetencyChangcheForGrade,
  runCompetencyChangcheChunkForGrade,
  runCompetencyHaengteukForGrade,
  runCompetencyHaengteukChunkForGrade,
} from "./pipeline-task-runners-competency";

// Draft Pipeline (P7-P8)
export {
  runDraftGenerationForGrade,
  runDraftGenerationChunkForGrade,
  runDraftAnalysisForGrade,
  runDraftAnalysisChunkForGrade,
} from "./pipeline-task-runners-draft";

// H1 / L3-A: Cross-subject Theme Extraction (Grade Pipeline P3.5)
export { runCrossSubjectThemeExtractionForGrade } from "./pipeline-task-runners-theme-extraction";
