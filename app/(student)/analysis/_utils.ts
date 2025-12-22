/**
 * @deprecated Use @/lib/domains/analysis instead
 * This file is kept for backward compatibility.
 */

export {
  fetchAllScores,
  fetchProgressMap,
  fetchPlansForSubject,
  calculateRiskIndex,
  calculateAllRiskIndices,
  saveRiskAnalysis,
} from "@/lib/domains/analysis";

export type {
  ScoreRow,
  ProgressRow,
  PlanRow,
  ContentRow,
  SubjectRiskAnalysis,
} from "@/lib/domains/analysis";
