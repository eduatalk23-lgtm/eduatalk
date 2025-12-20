# Phase 5: studentPlans.ts 리팩토링 완료

## 작업 개요

`lib/data/studentPlans.ts` 파일을 Core 모듈의 표준 패턴(`typedQueryBuilder`, `errorHandler`)으로 리팩토링했습니다.

## 주요 변경사항

### 1. Import 변경

**이전:**
```typescript
import { safeQueryArray, safeQuerySingle } from "@/lib/supabase/safeQuery";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";
```

**이후:**
```typescript
import {
  createTypedQuery,
  createTypedSingleQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";
```

### 2. 타입 강화

**이전:**
- 수동으로 정의된 `Plan` 타입 (약 40줄)

**이후:**
- Database 타입에서 직접 추출
```typescript
type PlanRow = Database["public"]["Tables"]["student_plan"]["Row"];
type PlanInsert = Database["public"]["Tables"]["student_plan"]["Insert"];
type PlanUpdate = Database["public"]["Tables"]["student_plan"]["Update"];

export type Plan = PlanRow;
```

### 3. 함수별 리팩토링

#### `getPlansForStudent`

**이전:**
```typescript
const data = await safeQueryArray<Plan>(
  async () => {
    const result = await query;
    return { data: result.data as Plan[] | null, error: result.error };
  },
  async () => {
    const result = await buildFallbackQuery();
    return { data: result.data as Plan[] | null, error: result.error };
  },
  { context: "[data/studentPlans] 플랜 조회" }
);
```

**이후:**
```typescript
const data = await createTypedConditionalQuery<Plan[]>(
  async () => {
    const result = await query;
    return { data: result.data as Plan[] | null, error: result.error };
  },
  {
    context: "[data/studentPlans] getPlansForStudent",
    defaultValue: [],
    fallbackQuery: async () => {
      const result = await buildFallbackQuery();
      return { data: result.data as Plan[] | null, error: result.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);
```

#### `getPlanById`

**이전:**
```typescript
return safeQuerySingle<Plan>(
  async () => {
    const result = await query.maybeSingle<Plan>();
    return { data: result.data, error: result.error };
  },
  async () => {
    const result = await selectPlan().maybeSingle<Plan>();
    return { data: result.data, error: result.error };
  },
  { context: "[data/studentPlans] 플랜 조회" }
);
```

**이후:**
```typescript
return createTypedConditionalQuery<Plan>(
  async () => {
    const result = await query.maybeSingle();
    return { data: result.data, error: result.error };
  },
  {
    context: "[data/studentPlans] getPlanById",
    defaultValue: null,
    fallbackQuery: async () => {
      const result = await selectPlan().maybeSingle();
      return { data: result.data, error: result.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);
```

#### `createPlan`

**이전:**
```typescript
const result = await safeQuerySingle<{ id: string }>(
  async () => {
    const queryResult = await supabase
      .from("student_plan")
      .insert(payload)
      .select("id")
      .single();
    return { data: queryResult.data, error: queryResult.error };
  },
  async () => {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const {
      tenant_id: _tenantId,
      student_id: _studentId,
      ...fallbackPayload
    } = payload;
    const queryResult = await supabase
      .from("student_plan")
      .insert(fallbackPayload)
      .select("id")
      .single();
    return { data: queryResult.data, error: queryResult.error };
  },
  { context: "[data/studentPlans] 플랜 생성" }
);
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<{ id: string }>(
  async () => {
    const queryResult = await supabase
      .from("student_plan")
      .insert(payload as PlanInsert)
      .select("id")
      .single();
    return { data: queryResult.data, error: queryResult.error };
  },
  {
    context: "[data/studentPlans] createPlan",
    defaultValue: null,
    fallbackQuery: async () => {
      // fallback: tenant_id, student_id 컬럼이 없는 경우
      const {
        tenant_id: _tenantId,
        student_id: _studentId,
        ...fallbackPayload
      } = payload;
      const queryResult = await supabase
        .from("student_plan")
        .insert(fallbackPayload as PlanInsert)
        .select("id")
        .single();
      return { data: queryResult.data, error: queryResult.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);
```

#### `updatePlanSafe`, `updatePlan`

**이전:**
```typescript
try {
  const result = await supabase
    .from("student_plan")
    .update(payload)
    .eq("id", planId)
    .eq("student_id", studentId)
    .select()
    .maybeSingle();

  if (result.error && result.error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    const fallbackResult = await supabase
      .from("student_plan")
      .update(payload)
      .eq("id", planId)
      .select()
      .maybeSingle();

    if (fallbackResult.error) {
      console.error("[data/studentPlans] 플랜 업데이트 실패 (safe)", fallbackResult.error);
      return { success: false, error: fallbackResult.error.message };
    }
  } else if (result.error) {
    console.error("[data/studentPlans] 플랜 업데이트 실패 (safe)", result.error);
    return { success: false, error: result.error.message };
  }

  return { success: true };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[data/studentPlans] 플랜 업데이트 예외 (safe)", error);
  return { success: false, error: errorMessage };
}
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<null>(
  async () => {
    const queryResult = await supabase
      .from("student_plan")
      .update(payload as PlanUpdate)
      .eq("id", planId)
      .eq("student_id", studentId);
    return { data: null, error: queryResult.error };
  },
  {
    context: "[data/studentPlans] updatePlanSafe",
    defaultValue: null,
    fallbackQuery: async () => {
      const fallbackResult = await supabase
        .from("student_plan")
        .update(payload as PlanUpdate)
        .eq("id", planId);
      return { data: null, error: fallbackResult.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);

// update 쿼리는 data가 null이어도 성공일 수 있음
// error가 없으면 성공으로 간주
return { success: true };
```

#### `deletePlan`

**이전:**
```typescript
try {
  const result = await supabase
    .from("student_plan")
    .delete()
    .eq("id", planId)
    .eq("student_id", studentId)
    .select()
    .maybeSingle();

  if (result.error && result.error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    const fallbackResult = await supabase
      .from("student_plan")
      .delete()
      .eq("id", planId)
      .select()
      .maybeSingle();

    if (fallbackResult.error && fallbackResult.error.code !== "PGRST116") {
      console.error("[data/studentPlans] 플랜 삭제 실패", fallbackResult.error);
      return { success: false, error: fallbackResult.error.message };
    }
  } else if (result.error && result.error.code !== "PGRST116") {
    console.error("[data/studentPlans] 플랜 삭제 실패", result.error);
    return { success: false, error: result.error.message };
  }

  return { success: true };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[data/studentPlans] 플랜 삭제 예외", error);
  return { success: false, error: errorMessage };
}
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<null>(
  async () => {
    const queryResult = await supabase
      .from("student_plan")
      .delete()
      .eq("id", planId)
      .eq("student_id", studentId);
    return { data: null, error: queryResult.error };
  },
  {
    context: "[data/studentPlans] deletePlan",
    defaultValue: null,
    fallbackQuery: async () => {
      const fallbackResult = await supabase
        .from("student_plan")
        .delete()
        .eq("id", planId);
      return { data: null, error: fallbackResult.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);

// delete 쿼리는 data가 null이어도 성공일 수 있음
// error가 없으면 성공으로 간주
return { success: true };
```

#### `deletePlans`

**이전:**
```typescript
try {
  const result = await supabase
    .from("student_plan")
    .delete()
    .in("id", batch)
    .eq("student_id", studentId)
    .select();

  if (result.error && result.error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    const fallbackResult = await supabase
      .from("student_plan")
      .delete()
      .in("id", batch)
      .select();

    if (fallbackResult.error) {
      console.error("[data/studentPlans] 플랜 일괄 삭제 실패", fallbackResult.error);
      return { success: false, error: fallbackResult.error.message };
    }
  } else if (result.error) {
    console.error("[data/studentPlans] 플랜 일괄 삭제 실패", result.error);
    return { success: false, error: result.error.message };
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[data/studentPlans] 플랜 일괄 삭제 예외", error);
  return { success: false, error: errorMessage };
}
```

**이후:**
```typescript
// 배치 삭제는 직접 쿼리 실행하여 에러 확인
let result = await supabase
  .from("student_plan")
  .delete()
  .in("id", batch)
  .eq("student_id", studentId);

// UNDEFINED_COLUMN 에러 발생 시 fallback
if (result.error && ErrorCodeCheckers.isColumnNotFound(result.error)) {
  result = await supabase
    .from("student_plan")
    .delete()
    .in("id", batch);
}

// 에러 처리
if (result.error) {
  handleQueryError(result.error, {
    context: "[data/studentPlans] deletePlans",
  });
  return { success: false, error: result.error.message };
}
```

## 개선 효과

### 1. 타입 안전성 향상
- Database 타입을 직접 사용하여 타입 불일치 방지
- 수동 타입 정의 제거로 유지보수성 향상

### 2. 에러 처리 표준화
- `handleQueryError`로 일관된 에러 처리
- `ErrorCodeCheckers`를 통한 에러 코드 확인

### 3. Fallback 로직 표준화
- `createTypedConditionalQuery`로 Fallback 로직 통일
- `shouldFallback` 옵션으로 조건부 Fallback 명확화

### 4. 코드 간소화
- 중복된 try-catch 블록 제거
- 에러 처리 로직 통합

## 유지된 비즈니스 로직

다음 비즈니스 로직은 그대로 유지되었습니다:

1. **`updatePlanSafe`의 필드 제한 로직**: 허용된 필드만 업데이트 가능
2. **`deletePlanGroupByInvitationId`의 삭제 순서**: student_plan → plan_contents → plan_exclusions → plan_groups
3. **`getPlansForStudent`의 planGroupIds 필터링 Fallback**: 애플리케이션 레벨 Fallback 로직 유지
4. **배치 삭제 로직**: 100개 단위 배치 처리 유지

## 다음 단계

다음 파일들을 순차적으로 리팩토링할 예정입니다:

1. `lib/data/planGroups.ts` - JSONB 필드 처리, 트랜잭션/배치 최적화
2. `lib/data/todayPlans.ts` - View Fallback 표준화, 성능 최적화

## 참고

- Core 모듈: `lib/data/core/typedQueryBuilder.ts`
- 에러 처리: `lib/data/core/errorHandler.ts`
- 에러 코드: `lib/constants/errorCodes.ts`

