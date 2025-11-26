# Supabase 클라이언트 사용 최적화 가이드

## 작업 일시
2025-01-31

## 개요
Server Actions에서 Supabase 클라이언트를 효율적으로 사용하고, N+1 쿼리 문제를 해결하여 성능을 개선합니다.

## 현재 상태

### 문제점
1. **각 함수마다 개별 클라이언트 생성**: `createSupabaseServerClient()` 호출이 643회
2. **순차 쿼리 실행**: 여러 쿼리를 순차적으로 실행하여 응답 시간 증가
3. **N+1 쿼리 문제**: 반복문 내에서 쿼리 실행

### 최적화 전략

#### 1. 클라이언트 재사용
- 같은 Server Action 내에서 여러 쿼리를 실행할 때 클라이언트를 한 번만 생성하고 재사용
- Next.js 15의 쿠키 제약사항을 고려하여 안전하게 재사용

#### 2. 병렬 쿼리 실행
- 독립적인 여러 쿼리를 `Promise.all()`로 병렬 실행
- Waterfall 쿼리 제거

#### 3. JOIN 쿼리 활용
- 관련 데이터를 JOIN으로 한 번에 조회
- `docs/테이블-조회-가이드.md` 참고

## 최적화 패턴

### Before: 순차 쿼리 실행
```typescript
async function _deletePlanGroup(groupId: string) {
  const supabase = await createSupabaseServerClient();
  
  // 1. 플랜 목록 조회
  const { data: plans } = await supabase
    .from("student_plan")
    .select("*")
    .eq("plan_group_id", groupId);

  // 2. 플랜 진행률 조회 (플랜 ID 필요)
  const planIds = plans?.map((p) => p.id) || [];
  const { data: progressData } = await supabase
    .from("student_content_progress")
    .select("*")
    .in("plan_id", planIds);
}
```

### After: 병렬 쿼리 실행 (가능한 경우)
```typescript
async function _deletePlanGroup(groupId: string) {
  const supabase = await createSupabaseServerClient();
  
  // 1. 플랜 목록 조회
  const plansQuery = supabase
    .from("student_plan")
    .select("*")
    .eq("plan_group_id", groupId);

  // 병렬로 쿼리 실행 (독립적인 경우)
  const [{ data: plans }] = await Promise.all([plansQuery]);

  // 2. 플랜 진행률 조회 (플랜 ID 필요 - 순차 실행 필요)
  const planIds = plans?.map((p) => p.id) || [];
  const progressQuery = planIds.length > 0
    ? supabase
        .from("student_content_progress")
        .select("*")
        .in("plan_id", planIds)
    : Promise.resolve({ data: null, error: null });

  const { data: progressData } = await progressQuery;
}
```

### 병렬 쿼리 실행 예시
```typescript
// 여러 독립적인 쿼리를 병렬로 실행
const [
  studentData,
  planGroupsData,
  goalsData,
  scoresData,
] = await Promise.all([
  supabase.from("students").select("*").eq("id", studentId).single(),
  supabase.from("plan_groups").select("*").eq("student_id", studentId),
  supabase.from("student_goals").select("*").eq("student_id", studentId),
  supabase.from("student_scores").select("*").eq("student_id", studentId),
]);
```

### JOIN 쿼리 활용
```typescript
// Before: N+1 쿼리 문제
const { data: planGroups } = await supabase
  .from("plan_groups")
  .select("*")
  .eq("student_id", studentId);

for (const group of planGroups || []) {
  const { data: contents } = await supabase
    .from("plan_contents")
    .select("*")
    .eq("plan_group_id", group.id);
}

// After: JOIN 쿼리 사용
const { data: planGroupsWithContents } = await supabase
  .from("plan_groups")
  .select(`
    *,
    plan_contents (*)
  `)
  .eq("student_id", studentId);
```

## 적용된 최적화

### 1. `app/(student)/actions/plan-groups/delete.ts`
- 백업 정보 수집 시 쿼리 구조 개선
- 클라이언트 재사용

### 2. `lib/data/core/queryBuilder.ts`
- `executeQueriesParallel`: 여러 쿼리를 병렬로 실행하는 헬퍼 함수 제공

## 권장 사항

### 1. 클라이언트 재사용
- 같은 Server Action 내에서 여러 쿼리를 실행할 때 클라이언트를 한 번만 생성
- 함수 파라미터로 클라이언트를 전달하는 것도 고려 (선택적)

### 2. 병렬 쿼리 실행
- 독립적인 여러 쿼리는 `Promise.all()`로 병렬 실행
- 의존성이 있는 쿼리는 순차 실행 유지

### 3. JOIN 쿼리 활용
- 관련 데이터를 한 번에 조회
- `docs/테이블-조회-가이드.md` 참고

### 4. 쿼리 최적화
- 필요한 필드만 선택 (`select()`)
- 인덱스 활용 (`.eq()`, `.in()` 등)
- 불필요한 데이터 조회 최소화

## 주의사항

1. **Next.js 15 쿠키 제약사항**
   - Server Component에서는 쿠키를 읽기 전용으로만 사용
   - Server Action이나 Route Handler에서만 쿠키 수정 가능
   - 클라이언트 재사용 시 쿠키 컨텍스트 유지

2. **에러 처리**
   - 병렬 쿼리 실행 시 `Promise.allSettled()` 사용 고려
   - 일부 쿼리 실패 시에도 다른 쿼리 결과 활용 가능

3. **성능 vs 안전성**
   - 클라이언트 재사용은 성능 향상에 도움이 되지만, 쿠키 컨텍스트를 올바르게 유지해야 함
   - 각 함수에서 클라이언트를 생성하는 것이 더 안전할 수 있음

## 참고 문서
- `docs/테이블-조회-가이드.md`
- `docs/data-fetching-pattern-refactoring.md`
- `lib/supabase/server.ts`

