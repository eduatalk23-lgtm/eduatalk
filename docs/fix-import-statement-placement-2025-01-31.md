# Import 문 위치 수정 - 2025-01-31

## 문제 상황

빌드 에러 발생:
- **에러 타입**: Parsing ecmascript source code failed
- **에러 위치**: `lib/hooks/useActivePlanDetails.ts:47:1`
- **에러 메시지**: 'import', and 'export' cannot be used outside of module code

## 원인 분석

`useActivePlanDetails.ts` 파일의 47번째 줄에 `import` 문이 함수 내부(`queryFn` 콜백 함수 안)에 잘못 배치되어 있었습니다.

```typescript
// ❌ 잘못된 위치 (함수 내부)
const { data: plan, error: planError } = await supabase
  .from("student_plan")
  .select(...)
  .eq("id", planId)
  .maybeSingle();

import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes"; // 함수 내부에 import!

if (planError) {
  // ...
}
```

## 해결 방법

`import` 문을 파일 최상단으로 이동시켜 다른 import 문들과 함께 배치했습니다.

```typescript
// ✅ 올바른 위치 (파일 상단)
"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes"; // 상단으로 이동
```

## 수정된 파일

- `lib/hooks/useActivePlanDetails.ts`
  - `POSTGRES_ERROR_CODES` import를 파일 상단으로 이동
  - 함수 내부의 잘못된 import 문 제거

## 검증

- ✅ 린터 에러 없음
- ✅ 빌드 에러 해결 예상

## 참고

JavaScript/TypeScript에서 `import`와 `export` 문은 모듈의 최상위 레벨에만 위치할 수 있습니다. 함수나 블록 내부에서는 사용할 수 없습니다.

