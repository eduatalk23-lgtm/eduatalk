// ============================================
// AI 파이프라인 태스크 러너 — 진입점 (re-export + 공용 헬퍼)
//
// 기존 import 경로 호환을 위해 모든 exported 함수를 이 파일에서 re-export한다.
// 각 함수의 실제 구현은 하위 모듈에 있음:
//   - pipeline-task-runners-shared.ts   : 공용 헬퍼 (runWithConcurrency, collectAnalysisContext 등)
//   - pipeline-task-runners-synthesis.ts : Synthesis 파이프라인 태스크 (S1-S6 + legacy)
//   - pipeline-task-runners-guide.ts     : 가이드 생성 태스크 (P4-P6 + slot)
//   - pipeline-task-runners-competency.ts: 역량 분석 태스크 (P1-P3 + ForGrade 변형)
// ============================================

// 공용 헬퍼 (일부 외부에서 직접 사용)
export {
  runWithConcurrency,
  collectAnalysisContext,
  toGuideAnalysisContext,
  buildGuideAnalysisContextFromReport,
} from "./pipeline-task-runners-shared";

// Synthesis Pipeline (S1-S6 + legacy competency_analysis)
export {
  runCompetencyAnalysis,
  runStorylineGeneration,
  runEdgeComputation,
  runAiDiagnosis,
  runCourseRecommendation,
  runGuideMatching,
  runActivitySummary,
  runAiStrategy,
  runBypassAnalysis,
  runInterviewGeneration,
  runRoadmapGeneration,
} from "./pipeline-task-runners-synthesis";

// Guide Pipeline (P4-P6 + slot)
export {
  runSetekGuide,
  runChangcheGuide,
  runHaengteukGuide,
  runSlotGeneration,
} from "./pipeline-task-runners-guide";

// Competency Pipeline — Grade 변형 (P1-P3 ForGrade)
export {
  runCompetencyAnalysisForGrade,
  runSetekGuideForGrade,
  runChangcheGuideForGrade,
  runHaengteukGuideForGrade,
  runCompetencySetekForGrade,
  runCompetencySetekChunkForGrade,
  runCompetencyChangcheForGrade,
  runCompetencyChangcheChunkForGrade,
  runCompetencyHaengteukForGrade,
  runCompetencyHaengteukChunkForGrade,
  runSlotGenerationForGrade,
} from "./pipeline-task-runners-competency";

// Draft Pipeline (P7-P8)
export {
  runDraftGenerationForGrade,
  runDraftAnalysisForGrade,
} from "./pipeline-task-runners-draft";
