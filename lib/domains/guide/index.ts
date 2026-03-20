// ============================================================
// CMS C1: 탐구 가이드 도메인 — Public API
// ============================================================

// 타입
export type {
  GuideType,
  GuideStatus,
  GuideSourceType,
  ContentFormat,
  QualityTier,
  AssignmentStatus,
  LinkedRecordType,
  UnitType,
  ExplorationGuide,
  ExplorationGuideContent,
  TheorySection,
  TheorySectionImage,
  RelatedPaper,
  CareerField,
  CurriculumUnit,
  GuideAssignment,
  GuideListItem,
  GuideDetail,
  GuideListFilter,
  GuideUpsertInput,
  GuideContentInput,
  AssignmentCreateInput,
  AssignmentWithGuide,
  GuideRecommendationFilter,
  ImportBatchResult,
  ImportMatchResult,
} from "./types";

// 상수
export {
  GUIDE_TYPES,
  GUIDE_STATUSES,
  GUIDE_SOURCE_TYPES,
  CONTENT_FORMATS,
  QUALITY_TIERS,
  ASSIGNMENT_STATUSES,
  LINKED_RECORD_TYPES,
  UNIT_TYPES,
  GUIDE_TYPE_LABELS,
  GUIDE_STATUS_LABELS,
} from "./types";
