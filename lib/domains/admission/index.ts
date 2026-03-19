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
  // Phase 8.3: 대학 공식 정보
  UniversityInfo,
  // Phase 8.6: 검색 타입
  AdmissionSearchFilter,
  PaginationParams,
  AdmissionSearchRow,
  AdmissionSearchResult,
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

// Phase 8.5b: 가채점/실채점 비교
export type {
  ExamType,
  PlacementSnapshot,
  PlacementChange,
} from "./placement/types";

export { compareSnapshots } from "./placement/engine";

// Phase 8.5c: 충원 합격 시뮬레이션
export type {
  ReplacementInfo,
  ReplacementProbabilityLevel,
} from "./placement/types";

export {
  parseReplacementCounts,
  calculateReplacementProbability,
  buildReplacementInfo,
} from "./placement/engine";

export type { MockScoreInput } from "./placement/score-converter";
export { convertToSuneungScores, createEmptyMockScoreInput } from "./placement/score-converter";

// Phase 8.5b: 수시 6장 최적 배분
export type {
  AllocationCandidate,
  AllocationTier,
  AllocationConfig,
  AllocationRecommendation,
} from "./allocation/types";

export { DEFAULT_ALLOCATION_CONFIG, LEVEL_TO_TIER, TIER_LABELS } from "./allocation/types";

export {
  generateCombinations,
  scoreCombination,
  simulateAllocation,
} from "./allocation/engine";
