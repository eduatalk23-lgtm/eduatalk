/**
 * LLM Services
 *
 * Phase 2: AI/LLM 비용 최적화
 * Phase 3: 콘텐츠 분석 및 추천
 */

// Phase 2.1: LLM 응답 캐시 레이어
export {
  LLMCacheService,
  withLLMCache,
  type OperationType,
  type TokenUsage as CacheTokenUsage,
  type CacheEntry,
  type CacheSetOptions,
  type CacheStats,
  type CleanupResult,
} from "./llmCacheService";

// Phase 2.2: 동적 프로바이더 선택
export {
  ProviderSelectionService,
  extractComplexityFromPlanRequest,
  type ComplexityInput,
  type ComplexityResult,
  type ComplexityBreakdown,
  type ProviderSelectionResult,
} from "./providerSelectionService";

// Phase 2.3: 토큰 최적화
export {
  TokenOptimizationService,
  getTokenOptimizationService,
  optimizeContents,
  optimizeLearningHistory,
  type ContentInfoFull,
  type ContentInfoOptimized,
  type LearningHistoryFull,
  type LearningHistoryOptimized,
  type TokenAnalysis,
  type TokenOptimizationSuggestion,
  type TokenBreakdown,
  type OptimizationResult,
} from "./tokenOptimizationService";

// Phase 3.1: 콘텐츠 난이도 분석
export {
  ContentDifficultyService,
  analyzeContentDifficulty,
  getContentDifficulty,
  analyzeWithCache,
  type ContentType,
  type AnalysisStatus,
  type StoredDifficultyAnalysis,
  type AnalyzeOptions,
  type AnalyzeResult,
  type QueueItem,
  type BatchAnalyzeResult,
} from "./contentDifficultyService";

// Phase 3.2: 선수지식 매핑
export {
  PrerequisiteService,
  getPrerequisiteGraph,
  suggestLearningOrder,
  identifyLearningGaps,
  recommendGapFillers,
  type StudentLevel,
  type Concept,
  type ConceptNode,
  type PrerequisiteGraph,
  type OrderedLearningPath,
  type ConceptPathItem,
  type LearningGap,
  type RecommendedContent as PrerequisiteRecommendedContent,
  type ContentConceptMapping,
  type StudentConceptMastery,
} from "./prerequisiteService";

// Phase 3.3: 맞춤형 콘텐츠 매칭
export {
  PersonalizedMatchingService,
  findMatchingContent,
  analyzeContentFit,
  findWeaknessFillers,
  findGapFillers,
  getStudentProfile,
  MATCH_FACTOR_WEIGHTS,
  type DifficultyFit,
  type MatchFactor,
  type MatchScore,
  type StudentProfile,
  type ContentCandidate,
  type MatchingOptions,
  type MatchingResult,
} from "./personalizedMatchingService";

// 웹 검색 콘텐츠 서비스 (Gemini Grounding)
export {
  WebSearchContentService,
  getWebSearchContentService,
  type WebContentType,
  type WebSearchContent,
  type SaveWebContentResult,
  type TransformContext,
  type FindExistingContentOptions,
  type ExistingContentItem,
} from "./webSearchContentService";

// 콘텐츠 구조 정보 공유 유틸리티
export {
  buildContentAnalysisData,
  toJsonField,
  hasValidChapters,
  type ChapterInfo,
  type ContentAnalysisData,
} from "./contentStructureUtils";
