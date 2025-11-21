# Step 7 개선 Phase 1 완료

## 작업 일시
2025-01-22

## 완료된 작업

### ✅ TODO 1: Step 7 제외일 조회 수정
**상태**: 완료

**변경 내용**:
- `student_plan_exclusions` 테이블 → `plan_exclusions` 테이블로 변경
- `plan_group_id`로 조회하도록 수정

**변경 전**:
```typescript
const { data: exclusions } = await supabase
  .from("student_plan_exclusions")  // ❌ 잘못된 테이블
  .select("exclusion_date, exclusion_type, reason")
  .eq("student_id", user.userId)
  .gte("exclusion_date", group.period_start || "")
  .lte("exclusion_date", group.period_end || "");
```

**변경 후**:
```typescript
// getPlanGroupWithDetails 사용 (일관성 유지)
const { exclusions, academySchedules } = await getPlanGroupWithDetails(
  groupId,
  user.userId,
  tenantId
);

// 기간 필터링 (제외일만)
const filteredExclusions = (exclusions || []).filter((e) => {
  if (!group.period_start || !group.period_end) return true;
  return e.exclusion_date >= group.period_start && e.exclusion_date <= group.period_end;
});
```

### ✅ TODO 2: getPlanGroupWithDetails 사용으로 통일
**상태**: 완료

**변경 내용**:
- `_getScheduleResultData`에서 `getPlanGroupWithDetails` 사용
- 제외일 및 학원 일정 조회를 일관된 방식으로 통일
- 코드 중복 제거 및 유지보수성 향상

**추가 변경**:
- `tenantId` 조회 로직 추가 (`getTenantContext` 사용)

## 개선 효과

1. **지정 휴일 정보 반영**: `plan_exclusions` 테이블에서 올바르게 조회하여 지정 휴일 정보가 정확히 반영됨
2. **일관성 유지**: Step 3과 Step 7이 동일한 데이터 소스(`getPlanGroupWithDetails`) 사용
3. **코드 중복 제거**: 제외일 조회 로직을 공통 함수로 통일
4. **유지보수성 향상**: 제외일 조회 로직 변경 시 한 곳만 수정하면 됨

## 다음 단계

Phase 2 (장기 개선)로 진행:
- TODO 3: 저장된 daily_schedule 우선 사용 로직 개선
- TODO 4: scheduler_options 버전 관리 추가
- TODO 5: Step 3과 Step 7 데이터 소스 통일 (이미 완료)

