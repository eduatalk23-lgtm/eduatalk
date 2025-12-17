# PostgrestFilterBuilder 타입 import 오류 수정

## 📋 작업 개요

Vercel 빌드 중 발생한 TypeScript 오류를 수정했습니다.

**오류 메시지**:
```
Type error: Cannot find module '@supabase/postgrest-js' or its corresponding type declarations.
```

## 🔍 문제 원인

`@supabase/postgrest-js`는 `@supabase/supabase-js`의 내부 의존성 패키지로, 직접 import할 수 없습니다. 이 패키지는 npm에 공개되어 있지 않으며, Supabase의 내부 구현에 사용됩니다.

## ✅ 해결 방법

`PostgrestFilterBuilder` 타입을 직접 import하는 대신, `@supabase/supabase-js`의 `SupabaseClient`에서 타입을 추론하도록 변경했습니다.

### 변경 전
```typescript
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
```

### 변경 후
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

// PostgrestFilterBuilder 타입 추론
// Supabase 쿼리 빌더의 타입을 추론합니다
type PostgrestFilterBuilder<T extends Record<string, unknown> = Record<string, unknown>> = 
  ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
```

## 📁 수정된 파일

1. **lib/data/contentQueryBuilder.ts**
   - `@supabase/postgrest-js` import 제거
   - `PostgrestFilterBuilder` 타입 사용 제거 (함수 내부에서 타입 추론 사용)

2. **lib/utils/contentFilters.ts**
   - `@supabase/postgrest-js` import 제거
   - `PostgrestFilterBuilder` 타입을 `SupabaseClient`에서 추론하도록 변경
   - 함수 시그니처의 제네릭 타입 단순화

3. **lib/utils/contentSort.ts**
   - `@supabase/postgrest-js` import 제거
   - `PostgrestFilterBuilder` 타입을 `SupabaseClient`에서 추론하도록 변경
   - 함수 시그니처의 제네릭 타입 단순화

## 🧪 테스트 결과

- ✅ 로컬 빌드 성공
- ✅ TypeScript 타입 체크 통과
- ✅ ESLint 오류 없음

## 📝 참고 사항

- Supabase v2에서는 내부 타입을 직접 import할 수 없습니다
- 쿼리 빌더의 타입은 `ReturnType`을 사용하여 추론할 수 있습니다
- 이 방법은 타입 안전성을 유지하면서도 빌드 오류를 해결합니다

## 🔗 관련 이슈

- Vercel 빌드 실패: `@supabase/postgrest-js` 모듈을 찾을 수 없음
- 해결일: 2025-01-15

