# Phase 2 에러 코드 상수화 작업 완료 보고

**작업 일자**: 2025-02-04  
**작업 범위**: 하드코딩된 에러 코드를 상수로 교체

## 개요

Phase 2 계획에 따라 하드코딩된 에러 코드를 `lib/constants/errorCodes.ts`의 상수로 교체하는 작업을 진행했습니다.

## 완료된 작업

### 1. 주요 파일 에러 코드 상수화

#### 1.1 `lib/data/planGroups.ts` (5곳 수정)

**수정 내용**:
- Line 377: `"PGRST116"` → `POSTGREST_ERROR_CODES.NO_ROWS_RETURNED`
- Line 1344: `"23505"` → `POSTGRES_ERROR_CODES.UNIQUE_VIOLATION`
- Line 1430: `"23505"` → `POSTGRES_ERROR_CODES.UNIQUE_VIOLATION`
- Line 1612: `"42703"` → `POSTGRES_ERROR_CODES.UNDEFINED_COLUMN`
- Line 2098: `"PGRST116"` → `POSTGREST_ERROR_CODES.NO_ROWS_RETURNED`
- Line 275: 주석의 `"42703"` → `UNDEFINED_COLUMN` 설명으로 변경

**효과**:
- 타입 안전성 향상
- 에러 코드 변경 시 한 곳에서만 수정하면 됨
- 코드 가독성 향상

#### 1.2 `lib/goals/queries.ts` (2곳 수정)

**수정 내용**:
- Line 190: `"42703"` → `POSTGRES_ERROR_CODES.UNDEFINED_COLUMN`
- Line 216: `"42703"` → `POSTGRES_ERROR_CODES.UNDEFINED_COLUMN`

**효과**:
- 컬럼이 없는 경우의 에러 처리가 일관되게 처리됨
- 에러 코드 상수 사용으로 유지보수성 향상

#### 1.3 주석 업데이트 (4곳)

**수정 파일**:
- `lib/hooks/useActivePlanDetails.ts`: 주석의 `"42703"` → `UNDEFINED_COLUMN` 설명
- `lib/hooks/useActivePlan.ts`: 주석의 `"42703"` → `UNDEFINED_COLUMN` 설명
- `lib/data/core/errorHandler.ts`: 주석의 `"42703"` → `UNDEFINED_COLUMN` 설명
- `lib/data/core/typedQueryBuilder.ts`: 주석의 `"42703"` → `UNDEFINED_COLUMN` 설명

**효과**:
- 주석이 실제 코드와 일치하도록 개선
- 문서 가독성 향상

## 기존 에러 코드 상수 파일

`lib/constants/errorCodes.ts`는 이미 잘 구성되어 있었습니다:

- **POSTGRES_ERROR_CODES**: PostgreSQL 에러 코드 상수
  - `UNDEFINED_COLUMN`: "42703"
  - `UNDEFINED_TABLE`: "42P01"
  - `UNIQUE_VIOLATION`: "23505"
  - `FOREIGN_KEY_VIOLATION`: "23503"
  - `NOT_NULL_VIOLATION`: "23502"
  - `CHECK_VIOLATION`: "23514"

- **POSTGREST_ERROR_CODES**: PostgREST 에러 코드 상수
  - `NO_ROWS_RETURNED`: "PGRST116"
  - `NO_CONTENT`: "PGRST204"
  - `TABLE_VIEW_NOT_FOUND`: "PGRST205"

- **ErrorCodeCheckers**: 에러 코드 확인 헬퍼 함수
  - `isColumnNotFound()`
  - `isTableNotFound()`
  - `isViewNotFound()`
  - `isNoRowsReturned()`
  - `isNoContent()`
  - `isUniqueViolation()`
  - `isForeignKeyViolation()`

## 남은 작업

다른 파일들에서도 하드코딩된 에러 코드가 발견되었습니다 (약 42개 파일). 점진적으로 개선할 예정입니다:

- `lib/data/studentPlans.ts`
- `lib/data/termsContents.ts`
- `lib/data/tenants.ts`
- `lib/auth/getTenantInfo.ts`
- `lib/data/difficultyLevels.ts`
- `lib/data/todayPlans.ts`
- 기타 등등...

## 개선 효과

1. **타입 안전성 향상**: 에러 코드를 상수로 사용하여 타입 체크 가능
2. **유지보수성 향상**: 에러 코드 변경 시 한 곳에서만 수정
3. **코드 가독성 향상**: 의미 있는 상수명으로 코드 이해도 향상
4. **일관성 향상**: 모든 파일에서 동일한 에러 코드 상수 사용

## 다음 단계

1. 나머지 파일들의 하드코딩된 에러 코드를 점진적으로 상수로 교체
2. `ErrorCodeCheckers` 헬퍼 함수 활용 확대
3. 에러 코드 관련 타입 정의 강화

## 참고 사항

- PostgreSQL 에러 코드: https://www.postgresql.org/docs/current/errcodes-appendix.html
- PostgREST 에러 코드: https://postgrest.org/en/stable/api.html#errors-and-http-status-codes

