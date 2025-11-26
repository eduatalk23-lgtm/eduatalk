# PlanGroupDetailPage 에러 로깅 개선

## 문제 상황

`PlanGroupDetailPage`에서 템플릿 블록 세트 조회 에러가 발생했을 때, 에러 객체가 빈 객체 `{}`로 표시되어 실제 에러 정보를 확인할 수 없었습니다.

## 에러 위치

- `app/(student)/plan/group/[id]/page.tsx:221:21`
- 템플릿 블록 세트 조회 시 `blockSetError` 로깅

## 원인 분석

Supabase 에러 객체는 직렬화되지 않는 속성들을 포함하고 있어서, `console.error`로 직접 출력하면 빈 객체로 표시될 수 있습니다. 에러 객체의 주요 속성들(`message`, `code`, `details`, `hint`, `statusCode`)을 명시적으로 추출해서 로깅해야 합니다.

## 수정 내용

### 1. 템플릿 블록 세트 조회 에러 로깅 개선

```typescript
if (blockSetError) {
  // Supabase 에러 객체의 주요 속성 추출
  const errorInfo: Record<string, unknown> = {
    message: blockSetError.message || String(blockSetError),
    code: blockSetError.code || "UNKNOWN",
  };
  if ("details" in blockSetError) {
    errorInfo.details = (blockSetError as { details?: unknown }).details;
  }
  if ("hint" in blockSetError) {
    errorInfo.hint = (blockSetError as { hint?: unknown }).hint;
  }
  if ("statusCode" in blockSetError) {
    errorInfo.statusCode = (blockSetError as { statusCode?: unknown }).statusCode;
  }
  console.error(
    "[PlanGroupDetailPage] 템플릿 블록 세트 조회 에러:",
    errorInfo,
    {
      block_set_id: blockSetId,
      template_id: group.camp_template_id,
    }
  );
}
```

### 2. 템플릿 조회 에러 로깅 개선

템플릿 조회 시 발생하는 에러도 동일한 방식으로 개선했습니다.

### 3. 템플릿 블록 조회 에러 로깅 개선

템플릿 블록 조회 시 발생하는 에러도 동일한 방식으로 개선했습니다.

## 개선 효과

1. **에러 정보 가시성 향상**: 에러 메시지, 코드, 상세 정보, 힌트, 상태 코드를 모두 확인할 수 있습니다.
2. **디버깅 용이성**: 컨텍스트 정보(block_set_id, template_id 등)를 함께 로깅하여 문제 원인 파악이 쉬워집니다.
3. **일관된 에러 로깅**: `lib/data/core/errorHandler.ts`의 `handleQueryError` 함수와 동일한 패턴을 사용합니다.

## 수정된 파일

- `app/(student)/plan/group/[id]/page.tsx`

## 참고사항

- Supabase 에러 객체는 `PostgrestError` 타입입니다.
- 에러 객체를 직접 로깅하면 직렬화되지 않는 속성으로 인해 빈 객체로 표시될 수 있습니다.
- 주요 속성들을 명시적으로 추출해서 로깅하는 것이 좋습니다.
- 향후 `handleQueryError` 함수를 사용하여 더 일관된 에러 처리를 할 수 있습니다.

