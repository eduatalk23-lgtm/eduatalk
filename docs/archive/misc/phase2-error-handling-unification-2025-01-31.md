# Phase 2 에러 처리 패턴 통일 작업 보고서

**작업 일자**: 2025-01-31  
**작업 범위**: 구조화된 에러 타입 정의, 공통 에러 처리 미들웨어 강화

## 개요

데이터 페칭 함수에서 일관된 에러 처리를 위해 구조화된 에러 타입을 정의하고, 공통 에러 처리 유틸리티를 강화했습니다.

## 완료된 작업

### 1. 구조화된 에러 타입 정의 (`lib/data/core/errorTypes.ts`)

#### 주요 타입

**`StructuredError`**
- 에러 메시지, 코드, 카테고리, 심각도 등 구조화된 정보 포함
- 원본 에러 객체 보존
- 컨텍스트 및 타임스탬프 정보 포함

**`ErrorSeverity`**
- `low`: 무시 가능한 에러 (예: PGRST116 - no rows returned)
- `medium`: 일반적인 에러 (예: 스키마 관련 에러)
- `high`: 중요한 에러 (예: 인증/인가 에러)
- `critical`: 치명적인 에러

**`ErrorCategory`**
- `database`: 데이터베이스 관련 에러
- `authentication`: 인증 에러
- `authorization`: 인가 에러
- `validation`: 검증 에러
- `network`: 네트워크 에러
- `unknown`: 알 수 없는 에러

#### 주요 함수

**`structureError(error, context?)`**
- PostgrestError, Error, 또는 unknown을 StructuredError로 변환
- 에러 코드를 카테고리와 심각도로 자동 매핑

**`isIgnorableError(error)`**
- 에러가 무시 가능한지 확인
- `low` 심각도 또는 `PGRST116` 에러 코드

**`isRecoverableError(error)`**
- 에러가 복구 가능한지 확인 (fallback 가능)
- 스키마 관련 에러 (42703, 42P01, PGRST205)

**`isRetryableError(error)`**
- 에러가 재시도 가능한지 확인
- 네트워크 에러 또는 `high` 심각도

### 2. 에러 핸들러 개선 (`lib/data/core/errorHandler.ts`)

#### 개선 사항

1. **구조화된 에러 사용**
   - `handleQueryError`가 `StructuredError`를 사용하도록 개선
   - 심각도에 따른 로그 레벨 자동 결정

2. **새로운 헬퍼 함수 추가**
   - `logStructuredError`: 구조화된 에러 로깅
   - `getStructuredError`: 에러를 구조화하여 반환
   - `canIgnoreError`: 에러 무시 가능 여부 확인
   - `canRecoverFromError`: 에러 복구 가능 여부 확인
   - `canRetryError`: 에러 재시도 가능 여부 확인

3. **로그 레벨 자동 결정**
   - `critical`/`high`: `console.error`
   - `medium`: `console.warn`
   - `low`: `console.info`

### 3. Export 추가

`lib/data/core/index.ts`에 `errorTypes` export를 추가하여 다른 모듈에서 쉽게 사용할 수 있도록 했습니다.

## 사용 예시

### 기본 사용

```typescript
import { handleQueryError, getStructuredError } from "@/lib/data/core";

const { data, error } = await supabase.from("students").select("*");

if (error) {
  const structured = getStructuredError(error, "[data/students]");
  
  if (canIgnoreError(error)) {
    // 무시 가능한 에러 (예: PGRST116)
    return [];
  }
  
  if (canRecoverFromError(error)) {
    // Fallback 쿼리 실행
    return await fallbackQuery();
  }
  
  // 에러 처리
  handleQueryError(error, { context: "[data/students]" });
  return [];
}
```

### 구조화된 에러 활용

```typescript
import { structureError, isRetryableError } from "@/lib/data/core/errorTypes";

try {
  const result = await query();
  return result;
} catch (error) {
  const structured = structureError(error, "[data/students]");
  
  if (isRetryableError(structured)) {
    // 재시도 로직
    return await retryQuery();
  }
  
  // 에러 로깅
  logStructuredError(structured);
  throw error;
}
```

### 에러 카테고리별 처리

```typescript
import { structureError } from "@/lib/data/core/errorTypes";

const structured = structureError(error, "[data/students]");

switch (structured.category) {
  case "database":
    // 데이터베이스 에러 처리
    if (structured.code === "42703") {
      // 컬럼이 없는 경우 fallback
      return await fallbackQuery();
    }
    break;
  case "authentication":
    // 인증 에러 처리
    redirectToLogin();
    break;
  case "authorization":
    // 인가 에러 처리
    showAccessDenied();
    break;
  default:
    // 기타 에러 처리
    logStructuredError(structured);
}
```

## 개선 효과

1. **일관된 에러 처리**: 모든 데이터 페칭 함수에서 동일한 패턴 사용
2. **에러 분류 자동화**: 에러 코드를 카테고리와 심각도로 자동 매핑
3. **로깅 개선**: 심각도에 따른 적절한 로그 레벨 사용
4. **에러 복구 지원**: 복구 가능한 에러 자동 감지
5. **타입 안전성**: 구조화된 에러 타입으로 타입 안전성 향상

## 마이그레이션 가이드

### 기존 코드

```typescript
if (error) {
  console.error("[data/students] 에러:", error);
  return [];
}
```

### 개선된 코드

```typescript
if (error) {
  handleQueryError(error, { context: "[data/students]" });
  return [];
}
```

### 구조화된 에러 사용

```typescript
if (error) {
  const structured = getStructuredError(error, "[data/students]");
  
  if (canIgnoreError(error)) {
    return [];
  }
  
  if (canRecoverFromError(error)) {
    return await fallbackQuery();
  }
  
  logStructuredError(structured);
  return [];
}
```

## 다음 단계

1. **기존 코드 마이그레이션**: 모든 데이터 페칭 함수에 새로운 에러 처리 패턴 적용
2. **에러 모니터링**: 구조화된 에러를 외부 모니터링 시스템에 전송
3. **에러 복구 전략**: 복구 가능한 에러에 대한 자동 복구 로직 구현
4. **에러 통계**: 에러 카테고리 및 심각도별 통계 수집

## 참고 사항

- 기존 `handleQueryError` 함수는 하위 호환성을 유지
- 구조화된 에러는 선택적으로 사용 가능
- 점진적으로 마이그레이션 가능

