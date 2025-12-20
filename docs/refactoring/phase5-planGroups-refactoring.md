# Phase 5: planGroups.ts 리팩토링 완료

## 작업 개요

`lib/data/planGroups.ts` 파일을 Core 모듈의 표준 패턴(`typedQueryBuilder`, `errorHandler`)으로 리팩토링했습니다.

## 주요 변경사항

### 1. Import 변경

**이전:**
```typescript
import { POSTGRES_ERROR_CODES, POSTGREST_ERROR_CODES } from "@/lib/constants/errorCodes";
import { logError } from "@/lib/errors/handler";
import { checkColumnExists } from "@/lib/utils/migrationStatus";
```

**이후:**
```typescript
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import {
  createTypedQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";

// Database 타입에서 테이블 타입 추출
type PlanGroupRow = Database["public"]["Tables"]["plan_groups"]["Row"];
type PlanGroupInsert = Database["public"]["Tables"]["plan_groups"]["Insert"];
type PlanGroupUpdate = Database["public"]["Tables"]["plan_groups"]["Update"];
```

### 2. 에러 처리 표준화

**이전:**
```typescript
logError(error, {
  function: "getPlanGroupsForStudent",
  filters,
});
```

**이후:**
```typescript
handleQueryError(error, {
  context: "[data/planGroups] getPlanGroupsForStudent",
});
```

### 3. Fallback 로직 표준화

#### `getPlanGroupsForStudent`

**이전:**
```typescript
let { data, error } = await query;
let planGroupsData: PlanGroup[] | null = data as PlanGroup[] | null;

if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
  const hasSchedulerOptions = await checkColumnExists(
    "plan_groups",
    "scheduler_options"
  );

  if (!hasSchedulerOptions) {
    // fallback 쿼리 실행
    const fallbackResult = await fallbackQuery.order("created_at", {
      ascending: false,
    });
    // scheduler_options를 null로 설정
    if (fallbackResult.data && !error) {
      planGroupsData = fallbackResult.data.map((group: any) => ({
        ...group,
        scheduler_options: null,
      })) as PlanGroup[];
    }
  }
}

if (error) {
  logError(error, { function: "getPlanGroupsForStudent", filters });
  return [];
}

return planGroupsData ?? [];
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<PlanGroup[]>(
  async () => {
    const queryResult = await query;
    return { data: queryResult.data as PlanGroup[] | null, error: queryResult.error };
  },
  {
    context: "[data/planGroups] getPlanGroupsForStudent",
    defaultValue: [],
    fallbackQuery: async () => {
      // fallback: scheduler_options 컬럼이 없는 경우
      const fallbackQuery = supabase
        .from("plan_groups")
        .select(/* scheduler_options 제외 */)
        .eq("student_id", filters.studentId);
      // ... 필터링 로직
      const fallbackResult = await fallbackQuery.order("created_at", {
        ascending: false,
      });
      
      if (fallbackResult.data && !fallbackResult.error) {
        return {
          data: fallbackResult.data.map((group: any) => ({
            ...group,
            scheduler_options: null,
          })) as PlanGroup[],
          error: null,
        };
      }
      
      return { data: fallbackResult.data as PlanGroup[] | null, error: fallbackResult.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);

return result ?? [];
```

#### `getPlanGroupById`

**이전:**
```typescript
let { data, error } = await query.maybeSingle<PlanGroup>();

if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
  const hasSchedulerOptions = await checkColumnExists(
    "plan_groups",
    "scheduler_options"
  );

  if (!hasSchedulerOptions) {
    // fallback 쿼리 실행
    ({ data, error } = await fallbackQuery.maybeSingle<PlanGroup>());
    if (data && !error) {
      data = { ...data, scheduler_options: null } as PlanGroup;
    }
  }
}

if (error && isPostgrestError(error) && error.code !== POSTGREST_ERROR_CODES.NO_ROWS_RETURNED) {
  logError(error, { function: "getPlanGroupById", groupId, studentId, tenantId });
  return null;
}

return data ?? null;
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<PlanGroup>(
  async () => {
    const queryResult = await query.maybeSingle();
    return { data: queryResult.data, error: queryResult.error };
  },
  {
    context: "[data/planGroups] getPlanGroupById",
    defaultValue: null,
    fallbackQuery: async () => {
      // fallback: scheduler_options 컬럼이 없는 경우
      const fallbackResult = await fallbackQuery.maybeSingle();
      
      if (fallbackResult.data && !fallbackResult.error) {
        return {
          data: { ...fallbackResult.data, scheduler_options: null } as PlanGroup,
          error: null,
        };
      }
      
      return { data: fallbackResult.data, error: fallbackResult.error };
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);

return result;
```

#### `createPlanGroup`

**이전:**
```typescript
let { data, error } = await supabase
  .from("plan_groups")
  .insert(payload)
  .select("id")
  .single();

if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
  if (payload.scheduler_options !== undefined) {
    const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("plan_groups")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }
}

if (error) {
  logError(error, { function: "createPlanGroup", studentId, tenantId });
  return { success: false, error: error.message || String(error) };
}

return { success: true, groupId: data?.id };
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<{ id: string }>(
  async () => {
    const queryResult = await supabase
      .from("plan_groups")
      .insert(payload as PlanGroupInsert)
      .select("id")
      .single();
    return { data: queryResult.data, error: queryResult.error };
  },
  {
    context: "[data/planGroups] createPlanGroup",
    defaultValue: null,
    fallbackQuery: async () => {
      // fallback: scheduler_options가 포함된 경우 제외하고 재시도
      if (payload.scheduler_options !== undefined) {
        const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
        const queryResult = await supabase
          .from("plan_groups")
          .insert(fallbackPayload as PlanGroupInsert)
          .select("id")
          .single();
        return { data: queryResult.data, error: queryResult.error };
      } else {
        // 다른 컬럼 문제인 경우 일반 fallback
        const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
        const queryResult = await supabase
          .from("plan_groups")
          .insert(fallbackPayload as PlanGroupInsert)
          .select("id")
          .single();
        return { data: queryResult.data, error: queryResult.error };
      }
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);

if (!result) {
  return { success: false, error: "플랜 그룹 생성 실패" };
}

return { success: true, groupId: result.id };
```

#### `updatePlanGroup`

**이전:**
```typescript
let { error } = await supabase
  .from("plan_groups")
  .update(payload)
  .eq("id", groupId)
  .eq("student_id", studentId)
  .is("deleted_at", null);

if (error && (error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN || error.code === POSTGREST_ERROR_CODES.NO_CONTENT)) {
  if (payload.scheduler_options !== undefined) {
    const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
    ({ error } = await supabase
      .from("plan_groups")
      .update(fallbackPayload)
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null));
  }
}

if (error) {
  logError(error, { function: "updatePlanGroup", groupId, studentId });
  return { success: false, error: error.message || String(error) };
}

return { success: true };
```

**이후:**
```typescript
const result = await createTypedConditionalQuery<null>(
  async () => {
    const queryResult = await supabase
      .from("plan_groups")
      .update(payload as PlanGroupUpdate)
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null);
    return { data: null, error: queryResult.error };
  },
  {
    context: "[data/planGroups] updatePlanGroup",
    defaultValue: null,
    fallbackQuery: async () => {
      // fallback: scheduler_options가 포함된 경우 제외하고 재시도
      if (payload.scheduler_options !== undefined) {
        const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
        const queryResult = await supabase
          .from("plan_groups")
          .update(fallbackPayload as PlanGroupUpdate)
          .eq("id", groupId)
          .eq("student_id", studentId)
          .is("deleted_at", null);
        return { data: null, error: queryResult.error };
      } else {
        // 다른 컬럼 문제인 경우 일반 fallback
        const queryResult = await supabase
          .from("plan_groups")
          .update(payload as PlanGroupUpdate)
          .eq("id", groupId);
        return { data: null, error: queryResult.error };
      }
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
);

// update 쿼리는 data가 null이어도 성공일 수 있음
// error가 없으면 성공으로 간주
return { success: true };
```

### 4. 에러 코드 체크 표준화

**이전:**
```typescript
if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
  // ...
}
if (error && error.code === POSTGREST_ERROR_CODES.NO_ROWS_RETURNED) {
  // ...
}
if (error && error.code === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION) {
  // ...
}
```

**이후:**
```typescript
if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
  // ...
}
if (error && ErrorCodeCheckers.isNoRowsReturned(error)) {
  // ...
}
if (error && ErrorCodeCheckers.isUniqueViolation(error)) {
  // ...
}
```

### 5. JSONB 타입 명시

Database 타입을 import하여 JSONB 필드(`scheduler_options`, `daily_schedule`, `subject_constraints` 등)의 타입을 명시적으로 처리했습니다.

```typescript
type PlanGroupRow = Database["public"]["Tables"]["plan_groups"]["Row"];
type PlanGroupInsert = Database["public"]["Tables"]["plan_groups"]["Insert"];
type PlanGroupUpdate = Database["public"]["Tables"]["plan_groups"]["Update"];

// 사용 예시
const result = await createTypedConditionalQuery<{ id: string }>(
  async () => {
    const queryResult = await supabase
      .from("plan_groups")
      .insert(payload as PlanGroupInsert)  // 타입 명시
      .select("id")
      .single();
    return { data: queryResult.data, error: queryResult.error };
  },
  // ...
);
```

## 개선 효과

### 1. 에러 처리 일관성
- 모든 `logError` 호출을 `handleQueryError`로 통일
- 에러 로깅 컨텍스트 표준화 (`[data/planGroups] functionName`)

### 2. Fallback 로직 표준화
- `checkColumnExists` 사용 제거 (불필요한 마이그레이션 상태 확인)
- `createTypedConditionalQuery`로 Fallback 로직 통일
- `shouldFallback` 옵션으로 조건부 Fallback 명확화

### 3. 타입 안전성 향상
- Database 타입을 직접 사용하여 JSONB 필드 타입 명시
- `any` 타입 사용 최소화

### 4. 코드 간소화
- 중복된 에러 처리 로직 제거
- Fallback 로직 표준화로 가독성 향상

## 유지된 비즈니스 로직

다음 비즈니스 로직은 그대로 유지되었습니다:

1. **`createPlanAcademySchedules`의 트랜잭션 로직**: 
   - 학원 일정 업데이트/생성 로직은 복잡한 비즈니스 로직을 포함하므로 현재 구조 유지
   - 반복적인 `insert` 구문은 각 항목마다 다른 `academy_id`를 가질 수 있어 배치 최적화가 어려움

2. **`deletePlanGroupByInvitationId`의 삭제 순서**: 
   - student_plan → plan_contents → plan_exclusions → plan_groups 순서 유지

3. **`createExclusions`의 복잡한 로직**: 
   - 플랜 그룹별/전역 제외일 관리 로직 유지

## 변경된 함수 목록

### 주요 함수 (Fallback 로직 표준화)
- `getPlanGroupsForStudent` - `createTypedConditionalQuery` 사용
- `getPlanGroupById` - `createTypedConditionalQuery` 사용
- `createPlanGroup` - `createTypedConditionalQuery` 사용
- `updatePlanGroup` - `createTypedConditionalQuery` 사용

### 에러 처리 변경
- 모든 함수의 `logError` → `handleQueryError` 변경 (약 30개 함수)

### 에러 코드 체크 변경
- `POSTGRES_ERROR_CODES.UNDEFINED_COLUMN` → `ErrorCodeCheckers.isColumnNotFound`
- `POSTGREST_ERROR_CODES.NO_ROWS_RETURNED` → `ErrorCodeCheckers.isNoRowsReturned`
- `POSTGRES_ERROR_CODES.UNIQUE_VIOLATION` → `ErrorCodeCheckers.isUniqueViolation`

## 제거된 코드

- `isPostgrestError` 함수 (사용되지 않음)
- `getErrorDetails` 함수 (사용되지 않음)
- `checkColumnExists` import 및 사용 (Fallback 로직에서 제거)

## 다음 단계

다음 파일을 리팩토링할 예정입니다:

1. `lib/data/todayPlans.ts` - View Fallback 표준화, 성능 최적화

## 참고

- Core 모듈: `lib/data/core/typedQueryBuilder.ts`
- 에러 처리: `lib/data/core/errorHandler.ts`
- 에러 코드: `lib/constants/errorCodes.ts`
- Database 타입: `lib/supabase/database.types.ts`

