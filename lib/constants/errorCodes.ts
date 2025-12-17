/**
 * Supabase/PostgreSQL 에러 코드 상수
 * 
 * 하드코딩된 에러 코드를 상수로 정의하여 타입 안전성과 유지보수성 향상
 */

/**
 * PostgreSQL 에러 코드
 * 
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const POSTGRES_ERROR_CODES = {
  /**
   * undefined_column (42703)
   * 컬럼이 존재하지 않을 때 발생
   * 마이그레이션 상태에 따라 발생할 수 있음
   */
  UNDEFINED_COLUMN: "42703",
  
  /**
   * undefined_table (42P01)
   * 테이블이 존재하지 않을 때 발생
   */
  UNDEFINED_TABLE: "42P01",
  
  /**
   * unique_violation (23505)
   * UNIQUE 제약 조건 위반
   */
  UNIQUE_VIOLATION: "23505",
  
  /**
   * foreign_key_violation (23503)
   * 외래 키 제약 조건 위반
   */
  FOREIGN_KEY_VIOLATION: "23503",
  
  /**
   * not_null_violation (23502)
   * NOT NULL 제약 조건 위반
   */
  NOT_NULL_VIOLATION: "23502",
  
  /**
   * check_violation (23514)
   * CHECK 제약 조건 위반
   */
  CHECK_VIOLATION: "23514",
} as const;

/**
 * PostgREST 에러 코드
 * 
 * @see https://postgrest.org/en/stable/api.html#errors-and-http-status-codes
 */
export const POSTGREST_ERROR_CODES = {
  /**
   * PGRST116
   * no rows returned (단일 행 조회 시 결과가 없을 때)
   * 에러로 처리하지 않고 null 반환
   */
  NO_ROWS_RETURNED: "PGRST116",
  
  /**
   * PGRST204
   * no content (업데이트/삭제 시 영향받은 행이 없을 때)
   */
  NO_CONTENT: "PGRST204",
  
  /**
   * PGRST205
   * table/view not found in schema cache
   * View 또는 테이블이 스키마 캐시에 없을 때
   */
  TABLE_VIEW_NOT_FOUND: "PGRST205",
} as const;

/**
 * 모든 에러 코드 통합
 */
export const ERROR_CODES = {
  ...POSTGRES_ERROR_CODES,
  ...POSTGREST_ERROR_CODES,
} as const;

/**
 * 에러 코드 타입
 */
export type PostgresErrorCode = typeof POSTGRES_ERROR_CODES[keyof typeof POSTGRES_ERROR_CODES];
export type PostgrestErrorCode = typeof POSTGREST_ERROR_CODES[keyof typeof POSTGREST_ERROR_CODES];
export type ErrorCode = PostgresErrorCode | PostgrestErrorCode;

/**
 * 에러 코드 확인 헬퍼 함수
 */
export const ErrorCodeCheckers = {
  /**
   * 컬럼이 존재하지 않는 에러인지 확인
   */
  isColumnNotFound: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN;
  },
  
  /**
   * 테이블이 존재하지 않는 에러인지 확인
   */
  isTableNotFound: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGRES_ERROR_CODES.UNDEFINED_TABLE;
  },
  
  /**
   * View가 존재하지 않는 에러인지 확인
   */
  isViewNotFound: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGREST_ERROR_CODES.TABLE_VIEW_NOT_FOUND;
  },
  
  /**
   * 행이 반환되지 않은 에러인지 확인 (에러로 처리하지 않음)
   */
  isNoRowsReturned: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGREST_ERROR_CODES.NO_ROWS_RETURNED;
  },
  
  /**
   * 컨텐츠가 없는 에러인지 확인 (업데이트/삭제 시 영향받은 행이 없을 때)
   */
  isNoContent: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGREST_ERROR_CODES.NO_CONTENT;
  },
  
  /**
   * UNIQUE 제약 조건 위반인지 확인
   */
  isUniqueViolation: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION;
  },
  
  /**
   * 외래 키 제약 조건 위반인지 확인
   */
  isForeignKeyViolation: (error: { code?: string } | null): boolean => {
    return error?.code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION;
  },
} as const;

