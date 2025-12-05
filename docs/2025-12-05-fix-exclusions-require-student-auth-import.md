# exclusions.ts에서 requireStudentAuth import 추가

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러
```
./app/(student)/actions/plan-groups/exclusions.ts:159:22
Type error: Cannot find name 'requireStudentAuth'.
```

## 원인 분석
`app/(student)/actions/plan-groups/exclusions.ts` 파일에서 `requireStudentAuth`와 `requireTenantContext` 함수를 사용하고 있지만, import 문이 누락되어 있었습니다.

## 수정 내용

### 파일
- `app/(student)/actions/plan-groups/exclusions.ts`

### 변경 사항

#### 수정: requireStudentAuth와 requireTenantContext import 추가
두 함수를 사용하는 `_addPlanExclusion` 함수에서 import 문이 누락되어 있었습니다. 필요한 import 문을 추가했습니다.

```typescript
// 수정 전
import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getPlanGroupById,
  getPlanGroupByIdForAdmin,
  createPlanExclusions,
  getStudentExclusions,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

// 수정 후
import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  getPlanGroupById,
  getPlanGroupByIdForAdmin,
  createPlanExclusions,
  getStudentExclusions,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `requireStudentAuth` 함수는 `lib/auth/requireStudentAuth.ts`에 정의되어 있습니다.
- `requireTenantContext` 함수는 `lib/tenant/requireTenantContext.ts`에 정의되어 있습니다.

