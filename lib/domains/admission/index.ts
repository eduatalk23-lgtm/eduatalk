export type {
  CompetitionRates,
  AdmissionResultYear,
  AdmissionResults,
  Replacements,
  AdmissionImportRow,
  MathRequirementImportRow,
  ScoreConfigImportRow,
  ConversionImportRow,
  PercentageConversionImportRow,
  RestrictionImportRow,
  YearMapping,
  ImportResult,
  ImportError,
  CleaningStats,
} from "./types";

// Phase 8.5a: 배치 판정
export type {
  PlacementLevel,
  PlacementVerdict,
  PlacementSummary,
  PlacementAnalysisResult,
  PlacementFilter,
  HistoricalComparison,
} from "./placement/types";

export { PLACEMENT_LABELS, PLACEMENT_COLORS } from "./placement/types";

export type { MockScoreInput } from "./placement/score-converter";
export { convertToSuneungScores, createEmptyMockScoreInput } from "./placement/score-converter";
