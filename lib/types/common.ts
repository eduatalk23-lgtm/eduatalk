/**
 * 공통 타입 정의
 * 
 * 여러 도메인에서 공통으로 사용되는 타입들을 중앙화하여 관리합니다.
 * 중복 타입 정의를 방지하고 타입 일관성을 보장합니다.
 */

// ============================================================================
// 기본 타입
// ============================================================================

/**
 * 콘텐츠 타입
 * 
 * @description
 * - book: 교재
 * - lecture: 강의
 * - custom: 커스텀 콘텐츠
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 제외 타입 (플랜 제외 사유)
 * 
 * @description
 * - 휴가: 휴가로 인한 제외
 * - 개인사정: 개인 사정으로 인한 제외
 * - 휴일지정: 휴일로 지정된 날짜
 * - 기타: 기타 사유
 */
export type ExclusionType = "휴가" | "개인사정" | "휴일지정" | "기타";

/**
 * 학생 수준
 * 
 * @description
 * - high: 상위 수준
 * - medium: 중위 수준
 * - low: 하위 수준
 */
export type StudentLevel = "high" | "medium" | "low";

// ============================================================================
// 공통 필드 타입
// ============================================================================

/**
 * 공통 타임스탬프 필드
 */
export type TimestampFields = {
  created_at: string;
  updated_at: string;
};

/**
 * 공통 ID 필드
 */
export type IdField = {
  id: string;
};

/**
 * 테넌트 필드
 */
export type TenantField = {
  tenant_id?: string | null;
};

/**
 * 소프트 삭제 필드
 */
export type SoftDeleteField = {
  deleted_at?: string | null;
};

// ============================================================================
// 공통 유틸리티 타입
// ============================================================================

/**
 * 선택적 필드 타입
 * 
 * @example
 * type PartialStudent = PartialFields<Student, "id" | "created_at">;
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 필수 필드 타입
 * 
 * @example
 * type RequiredStudent = RequiredFields<Student, "name" | "grade">;
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Nullable 필드 타입
 * 
 * @example
 * type NullableStudent = NullableFields<Student, "school_id">;
 */
export type NullableFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};

/**
 * Non-nullable 필드 타입
 * 
 * @example
 * type NonNullableStudent = NonNullableFields<Student, "name">;
 */
export type NonNullableFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: NonNullable<T[P]>;
};

// ============================================================================
// 공통 응답 타입
// ============================================================================

/**
 * API 응답 기본 구조
 */
export type ApiResponse<T> = {
  data: T;
  error?: string | null;
  message?: string | null;
};

/**
 * 페이지네이션 메타데이터
 */
export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * 페이지네이션된 응답
 */
export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

// ============================================================================
// 공통 상태 타입
// ============================================================================

/**
 * 일반적인 상태 타입
 */
export type Status = "active" | "inactive" | "pending" | "archived" | "deleted";

/**
 * 승인 상태 타입
 */
export type ApprovalStatus = "pending" | "approved" | "rejected";

// ============================================================================
// 공통 날짜/시간 타입
// ============================================================================

/**
 * 날짜 범위
 */
export type DateRange = {
  start: string; // ISO date string (YYYY-MM-DD)
  end: string; // ISO date string (YYYY-MM-DD)
};

/**
 * 시간 범위
 */
export type TimeRange = {
  start: string; // ISO time string (HH:mm:ss)
  end: string; // ISO time string (HH:mm:ss)
};

/**
 * 날짜-시간 범위
 */
export type DateTimeRange = {
  start: string; // ISO datetime string
  end: string; // ISO datetime string
};

