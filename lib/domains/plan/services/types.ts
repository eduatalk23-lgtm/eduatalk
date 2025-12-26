/**
 * 플랜 생성 서비스 타입 정의
 *
 * 플랜 생성 관련 서비스에서 사용하는 타입들을 정의합니다.
 * 기존 lib/types/plan-generation.ts 타입을 확장합니다.
 *
 * @module lib/domains/plan/services/types
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DetailIdMap,
  GeneratePlanPayload,
  DayType,
} from "@/lib/types/plan-generation";
import type { PlanContent, ContentType } from "@/lib/types/plan";

// ============================================
// 서비스 컨텍스트 타입
// ============================================

/**
 * 플랜 생성 서비스 컨텍스트
 * 모든 서비스에서 공통으로 사용하는 컨텍스트
 */
export interface PlanServiceContext {
  /** Supabase 클라이언트 (학생 데이터 조회용) */
  queryClient: SupabaseAnyClient;
  /** Supabase 클라이언트 (마스터 데이터 조회용) */
  masterQueryClient: SupabaseAnyClient;
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 플랜 그룹 ID */
  groupId: string;
  /** 캠프 모드 여부 */
  isCampMode: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAnyClient = SupabaseClient<any>;

// ============================================
// ContentResolutionService 타입
// ============================================

/**
 * 콘텐츠 해석 입력
 */
export interface ContentResolutionInput {
  /** plan_contents 배열 */
  contents: PlanContent[];
  /** 서비스 컨텍스트 */
  context: PlanServiceContext;
}

/**
 * 해석된 콘텐츠 정보
 */
export interface ResolvedContent {
  /** 원본 plan_contents의 content_id */
  originalContentId: string;
  /** 해석된 콘텐츠 ID (마스터 또는 학생 콘텐츠) */
  resolvedContentId: string;
  /** 학생 콘텐츠 ID (실제 사용할 ID) */
  studentContentId: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 마스터 콘텐츠에서 복사되었는지 여부 */
  isCopiedFromMaster: boolean;
  /** 복사 실패 이유 (있는 경우) */
  copyFailureReason?: string;
}

/**
 * 콘텐츠 해석 결과
 */
export interface ContentResolutionResult {
  /** 해석된 콘텐츠 목록 */
  resolvedContents: ResolvedContent[];
  /** 콘텐츠 ID 매핑 (원본 → 학생) */
  contentIdMap: ContentIdMap;
  /** 상세 ID 매핑 (마스터 → 학생) - detail/episode */
  detailIdMap: DetailIdMap;
  /** 복사 실패 콘텐츠 */
  copyFailures: ContentCopyFailure[];
  /** 콘텐츠 메타데이터 맵 */
  metadataMap: ContentMetadataMap;
  /** 콘텐츠 소요시간 맵 */
  durationMap: ContentDurationMap;
  /** 챕터 정보 맵 */
  chapterMap: ContentChapterMap;
}

/**
 * 콘텐츠 복사 실패 정보
 */
export interface ContentCopyFailure {
  /** 원본 콘텐츠 ID */
  contentId: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 실패 이유 */
  reason: string;
}

// ============================================
// PlanPayloadBuilder 타입
// ============================================

/**
 * 스케줄 결과에서 가져온 일별 플랜 정보
 */
export interface DailyScheduleItem {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 블록 인덱스 */
  blockIndex: number;
  /** 콘텐츠 ID (원본) */
  contentId: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 시작 범위 (페이지/분) */
  startRange: number;
  /** 종료 범위 (페이지/분) */
  endRange: number;
  /** 시작 시간 */
  startTime: string | null;
  /** 종료 시간 */
  endTime: string | null;
  /** 일 유형 */
  dayType: DayType;
  /** 주차 번호 */
  weekNumber: number | null;
  /** 일차 번호 */
  dayNumber: number | null;
  /** 부분 플랜 여부 */
  isPartial: boolean;
  /** 연속 플랜 여부 */
  isContinued: boolean;
  /** 플랜 번호 */
  planNumber: number | null;
  /** 슬롯 인덱스 (new-plan-wizard) */
  slotIndex?: number;
}

/**
 * 페이로드 빌드 입력
 */
export interface PayloadBuildInput {
  /** 일별 스케줄 항목 */
  scheduleItems: DailyScheduleItem[];
  /** 콘텐츠 해석 결과 */
  contentResolution: ContentResolutionResult;
  /** 서비스 컨텍스트 */
  context: PlanServiceContext;
}

/**
 * 페이로드 빌드 결과
 */
export interface PayloadBuildResult {
  /** 생성된 플랜 페이로드 */
  payloads: GeneratePlanPayload[];
  /** 시퀀스가 할당된 페이로드 */
  sequencedPayloads: GeneratePlanPayload[];
  /** 경고 메시지 */
  warnings: string[];
}

// ============================================
// PlanValidationService 타입
// ============================================

/**
 * 검증 에러
 */
export interface ValidationError {
  /** 에러 코드 */
  code: string;
  /** 에러 메시지 */
  message: string;
  /** 관련 필드 */
  field?: string;
  /** 관련 콘텐츠 ID */
  contentId?: string;
}

/**
 * 검증 경고
 */
export interface ValidationWarning {
  /** 경고 코드 */
  code: string;
  /** 경고 메시지 */
  message: string;
  /** 관련 필드 */
  field?: string;
  /** 관련 콘텐츠 ID */
  contentId?: string;
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  /** 검증 통과 여부 */
  isValid: boolean;
  /** 에러 목록 */
  errors: ValidationError[];
  /** 경고 목록 */
  warnings: ValidationWarning[];
}

// ============================================
// PlanPersistenceService 타입
// ============================================

/**
 * 플랜 삽입 결과
 */
export interface PlanInsertResult {
  /** 성공 여부 */
  success: boolean;
  /** 삽입된 플랜 ID 목록 */
  insertedIds: string[];
  /** 삽입된 플랜 수 */
  insertedCount: number;
  /** 에러 목록 */
  errors: PlanInsertError[];
}

/**
 * 플랜 삽입 에러
 */
export interface PlanInsertError {
  /** 배치 인덱스 */
  batchIndex: number;
  /** 에러 메시지 */
  message: string;
  /** 원본 에러 */
  originalError?: unknown;
}

/**
 * 배치 삽입 옵션
 */
export interface BatchInsertOptions {
  /** 배치 크기 (기본값: 100) */
  batchSize?: number;
  /** 실패 시 롤백 여부 (기본값: true) */
  rollbackOnFailure?: boolean;
}

// ============================================
// 최종 생성 결과 타입
// ============================================

/**
 * 플랜 생성 최종 결과
 */
export interface GeneratePlansResult {
  /** 성공 여부 */
  success: boolean;
  /** 생성된 플랜 수 */
  count: number;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 경고 목록 */
  warnings?: string[];
  /** 콘텐츠 복사 실패 목록 */
  contentCopyFailures?: ContentCopyFailure[];
}

// ============================================
// Re-export 기존 타입
// ============================================

export type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DetailIdMap,
  GeneratePlanPayload,
  DayType,
} from "@/lib/types/plan-generation";

export type { PlanContent, ContentType } from "@/lib/types/plan";

// ============================================
// ContentChapterMap 타입 (contentResolver와 일치)
// ============================================

/**
 * 콘텐츠별 챕터 정보 맵
 *
 * lib/plan/contentResolver.ts의 ContentChapterMap과 동일한 타입입니다.
 * lib/types/plan-generation.ts의 ChapterInfo 기반 타입과는 다릅니다.
 */
export type ContentChapterMap = Map<string, string | null>;
