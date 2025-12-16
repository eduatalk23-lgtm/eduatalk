# 네트워크 에러 처리 개선

## 작업 일시
2025-12-16

## 문제 상황
교재 검색 시 네트워크 연결이 끊어졌을 때 다음과 같은 에러가 발생했습니다:
```
[data/contentMasters] 교재 검색 실패 gateway error: Error: Network connection lost.
Error: 교재 검색에 실패했습니다.
```

## 개선 내용

### 1. 에러 정규화 함수 개선 (`lib/errors/handler.ts`)

네트워크 관련 에러 메시지를 감지하여 사용자 친화적인 메시지로 변환하도록 개선했습니다:

```typescript
// 에러 메시지 기반 네트워크 에러 감지 (PostgREST gateway error 등)
const errorMessageLower = error.message.toLowerCase();
if (
  errorMessageLower.includes("network connection lost") ||
  errorMessageLower.includes("gateway error") ||
  errorMessageLower.includes("connection") ||
  errorMessageLower.includes("network") ||
  errorMessageLower.includes("fetch failed") ||
  errorMessageLower.includes("timeout")
) {
  return new AppError(
    "네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.",
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    503,
    true
  );
}
```

### 2. 교재/강의 검색 함수 에러 처리 개선 (`lib/data/contentMasters.ts`)

`searchMasterBooks`와 `searchMasterLectures` 함수에서 `normalizeError`와 `logError`를 사용하여 에러를 정규화하고 로깅하도록 개선했습니다:

**변경 전:**
```typescript
if (error) {
  console.error("[data/contentMasters] 교재 검색 실패", error);
  throw new Error(error.message || "교재 검색에 실패했습니다.");
}
```

**변경 후:**
```typescript
if (error) {
  console.error("[data/contentMasters] 교재 검색 실패", error);
  
  // normalizeError로 에러 정규화 및 로깅
  const normalizedError = normalizeError(error);
  logError(normalizedError, {
    context: "searchMasterBooks",
    filters: {
      curriculum_revision_id: filters.curriculum_revision_id,
      subject_group_id: filters.subject_group_id,
      subject_id: filters.subject_id,
      publisher_id: filters.publisher_id,
      search: filters.search,
      difficulty: filters.difficulty,
      tenantId: filters.tenantId,
    },
  });
  throw normalizedError;
}
```

## 개선 효과

1. **사용자 친화적인 에러 메시지**: 네트워크 에러 발생 시 "교재 검색에 실패했습니다" 대신 "네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요."라는 명확한 메시지 제공

2. **에러 로깅 개선**: 에러 발생 시 컨텍스트 정보(필터 조건 등)와 함께 로깅되어 디버깅이 용이해짐

3. **일관된 에러 처리**: 모든 에러가 `normalizeError`를 통해 정규화되어 일관된 형태로 처리됨

## 관련 파일

- `lib/errors/handler.ts`: 에러 정규화 함수 개선
- `lib/data/contentMasters.ts`: 교재/강의 검색 함수 에러 처리 개선

