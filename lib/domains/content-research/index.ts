/**
 * 콘텐츠 리서치 도메인
 *
 * AI 메타데이터 추출 및 콘텐츠 등록 관련 기능
 */

// Types
export type {
  ContentType,
  ExtractedMetadata,
  ExtractMetadataRequest,
  ExtractMetadataResult,
  PublisherPattern,
  QuickBookRegistrationRequest,
  QuickLectureRegistrationRequest,
  ImportRowValidation,
  BulkImportValidationResult,
  AIExtractionLog,
} from "./types";

// Services
export {
  AIMetadataExtractor,
  getAIMetadataExtractor,
  calculateOverallConfidence,
  isMetadataComplete,
} from "./services/aiMetadataExtractor";

export {
  BulkImportService,
  REQUIRED_FIELDS,
  RECOMMENDED_FIELDS,
  formatValidationSummary,
  normalizeRowForDB,
} from "./services/bulkImportService";

// Prompts
export {
  METADATA_EXTRACTION_SYSTEM_PROMPT,
  buildMetadataExtractionPrompt,
  parseMetadataResponse,
  estimateMetadataExtractionTokens,
} from "./prompts/metadataExtraction";

// Actions
export {
  extractContentMetadata,
  extractBatchMetadata,
  getMetadataQualityScore,
} from "./actions/extractMetadata";

export {
  validateImportData,
  applyAISuggestionsToRows,
  getFieldRequirements,
} from "./actions/validateImport";

export {
  getPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerSyncLogs,
  togglePartnerActive,
  type ContentPartner,
  type PartnerSyncLog,
  type CreatePartnerInput,
  type UpdatePartnerInput,
} from "./actions/partners";
