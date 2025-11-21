# scheduler_options 컬럼 fallback 처리

## 작업 일시
2025-01-XX

## 문제점
`plan_groups` 테이블에 `scheduler_options` 컬럼이 없을 때 에러가 발생했습니다. 이 컬럼은 최근에 추가된 것으로 보이며, 모든 데이터베이스에 반영되지 않았을 수 있습니다.

## 수정 내용

### 1. getPlanGroupById fallback 개선
**파일**: `lib/data/planGroups.ts`

**이전**:
```typescript
if (error && error.code === "42703") {
  ({ data, error } = await selectGroup().maybeSingle<PlanGroup>());
}
```

**개선**:
```typescript
// 컬럼이 없는 경우 fallback (scheduler_options 제외)
if (error && error.code === "42703") {
  console.warn("[data/planGroups] scheduler_options 컬럼이 없어 fallback 쿼리 사용", {
    groupId,
    studentId,
    tenantId,
  });
  
  const fallbackSelect = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null);
  
  let fallbackQuery = fallbackSelect();
  if (tenantId) {
    fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
  }
  
  ({ data, error } = await fallbackQuery.maybeSingle<PlanGroup>());
  
  // fallback 성공 시 scheduler_options를 null로 설정
  if (data && !error) {
    data = { ...data, scheduler_options: null } as PlanGroup;
  }
}
```

### 2. getPlanGroupsForStudent fallback 개선
**파일**: `lib/data/planGroups.ts`

**이전**:
```typescript
if (error && error.code === "42703") {
  // fallback: 컬럼이 없는 경우
  const fallbackQuery = supabase
    .from("plan_groups")
    .select("*")
    .eq("student_id", filters.studentId);
  // ...
}
```

**개선**:
```typescript
if (error && error.code === "42703") {
  // fallback: 컬럼이 없는 경우 (scheduler_options 제외)
  console.warn("[data/planGroups] scheduler_options 컬럼이 없어 fallback 쿼리 사용", {
    studentId: filters.studentId,
    tenantId: filters.tenantId,
  });
  
  const fallbackQuery = supabase
    .from("plan_groups")
    .select(
      "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,created_at,updated_at"
    )
    .eq("student_id", filters.studentId);
  // ...
  
  // fallback 성공 시 scheduler_options를 null로 설정
  if (data && !error) {
    data = data.map((group) => ({ ...group, scheduler_options: null })) as PlanGroup[];
  }
}
```

### 3. 에러 로깅 개선
에러 객체의 모든 속성을 안전하게 추출하여 로깅하도록 개선했습니다.

## 개선 사항

1. **Fallback 로직 강화**: `scheduler_options` 컬럼이 없을 때 명시적으로 제외하고 fallback 쿼리 실행
2. **경고 로그 추가**: fallback이 사용될 때 경고 로그를 출력하여 문제를 추적할 수 있음
3. **타입 안전성**: fallback 성공 시 `scheduler_options`를 `null`로 설정하여 타입 일관성 유지
4. **에러 로깅 개선**: 에러 객체의 모든 속성을 안전하게 추출하여 로깅

## 참고

- 에러 코드 `42703`은 PostgreSQL에서 컬럼이 존재하지 않을 때 발생하는 에러입니다.
- `scheduler_options` 컬럼이 데이터베이스에 추가되면 fallback이 자동으로 사용되지 않습니다.
- 마이그레이션 파일에 `scheduler_options` 컬럼 추가가 필요할 수 있습니다.

