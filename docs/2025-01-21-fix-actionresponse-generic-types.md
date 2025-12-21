# ActionResponse 제네릭 타입 지원 개선

## 작업 일시
2025-01-21

## 문제 상황
TypeScript 컴파일 시 214개의 에러가 발생했으며, 주요 원인은 다음과 같았습니다:

1. **`createErrorResponse`가 제네릭 타입을 지원하지 않음**
   - `ActionResponse<void>`만 반환하여 `ActionResponse<T>`를 요구하는 함수와 타입 불일치 발생
   - 예: `app/actions/auth.ts:554`, `app/actions/tenants.ts:24` 등

2. **`errorToActionResponse`가 제네릭 타입을 지원하지 않음**
   - `withActionResponse`에서 `errorToActionResponse`를 호출할 때 제네릭 타입을 전달할 수 없음
   - `lib/utils/serverActionHandler.ts:147`, `lib/utils/serverActionHandler.ts:163` 등

## 수정 내용

### 1. `createErrorResponse`에 제네릭 타입 추가

**변경 전:**
```typescript
export const createErrorResponse = (
  error: string,
  validationErrors?: Record<string, string[]>,
  message?: string
): ActionResponse => ({
  success: false,
  error,
  validationErrors,
  message: message || error,
});
```

**변경 후:**
```typescript
export const createErrorResponse = <T = void>(
  error: string,
  validationErrors?: Record<string, string[]>,
  message?: string
): ActionResponse<T> => ({
  success: false,
  error,
  validationErrors,
  message: message || error,
});
```

### 2. `errorToActionResponse`에 제네릭 타입 추가

**변경 전:**
```typescript
function errorToActionResponse(error: unknown): ActionResponse {
  // ...
}
```

**변경 후:**
```typescript
function errorToActionResponse<T = void>(error: unknown): ActionResponse<T> {
  // ...
}
```

### 3. `errorToActionResponse` 내부의 `createErrorResponse` 호출에 제네릭 타입 전달

모든 `createErrorResponse` 호출에 `<T>` 타입 파라미터 추가:
- Zod 에러 처리: `createErrorResponse<T>(...)`
- AppError 처리: `createErrorResponse<T>(...)`
- 일반 에러 처리: `createErrorResponse<T>(...)`

### 4. `withActionResponse`에서 제네릭 타입 전달

**변경 전:**
```typescript
} catch (error) {
  return errorToActionResponse(error);
}
```

**변경 후:**
```typescript
} catch (error) {
  return errorToActionResponse<T>(error);
}
```

### 5. `createSuccessResponse` 호출에도 제네릭 타입 전달

정보성 메시지 처리 시에도 제네릭 타입 전달:
```typescript
return createSuccessResponse<T>(undefined, message);
```

## 변경 파일
- `lib/types/actionResponse.ts`
- `lib/utils/serverActionHandler.ts`

## 결과
- TypeScript 컴파일 에러 12개 해결 (214개 → 202개)
- `ActionResponse<void>` vs `ActionResponse<T>` 타입 불일치 문제 해결
- 제네릭 타입 지원으로 타입 안전성 향상

## 남은 에러들
다음과 같은 패턴의 에러들이 남아있습니다:
1. Import declaration conflicts (같은 이름의 함수를 import하고 로컬에서도 선언)
2. 함수 시그니처 불일치 (인자 개수/타입 불일치)
3. null/undefined 타입 처리
4. ActionResponse를 직접 사용하는 대신 데이터만 반환하는 함수들

## 커밋
- `1939bf2b`: fix: ActionResponse 제네릭 타입 지원 개선

