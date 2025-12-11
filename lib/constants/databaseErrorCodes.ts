/**
 * PostgreSQL 및 Supabase 데이터베이스 에러 코드 상수
 * 
 * 참고:
 * - PostgreSQL 에러 코드: https://www.postgresql.org/docs/current/errcodes-appendix.html
 * - Supabase PostgREST 에러 코드: https://postgrest.org/en/stable/api.html#errors-and-http-status-codes
 */
export const DATABASE_ERROR_CODES = {
  // 제약 조건 위반
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
  CHECK_VIOLATION: "23514",
  
  // RLS 정책 위반
  RLS_POLICY_VIOLATION: "42501",
  
  // PostgREST 에러
  NOT_FOUND: "PGRST116",
  
  // 연결 오류
  CONNECTION_FAILURE: "08000",
  CONNECTION_DOES_NOT_EXIST: "08003",
  CONNECTION_FAILURE_SQLSTATE: "08006",
} as const;

export type DatabaseErrorCode = typeof DATABASE_ERROR_CODES[keyof typeof DATABASE_ERROR_CODES];

