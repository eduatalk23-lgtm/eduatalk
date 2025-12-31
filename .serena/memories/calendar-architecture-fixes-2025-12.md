# 캘린더 아키텍처 개선 (2025-12-31)

## 1. DB 레이스 컨디션 방지 (CRITICAL)

### 마이그레이션
`supabase/migrations/20251231230000_add_unique_active_session_per_student.sql`

```sql
-- 플랜당 활성 세션 유니크 인덱스
CREATE UNIQUE INDEX idx_unique_active_session_per_plan
  ON student_study_sessions(plan_id) WHERE ended_at IS NULL;

-- 학생당 활성 세션 유니크 인덱스  
CREATE UNIQUE INDEX idx_unique_active_session_per_student
  ON student_study_sessions(student_id) WHERE ended_at IS NULL;
```

### 효과
- 동시 다중 세션 시작 방지
- 레이스 컨디션으로 인한 데이터 불일치 방지
- timer.ts, studentSessions.ts에서 참조

---

## 2. 제외일 검증 추가 (HIGH)

### 파일
- `lib/domains/plan/actions/move.ts`
- `lib/domains/plan/actions/calendarDrag.ts`

### 헬퍼 함수
```typescript
async function checkExclusionDate(
  supabase: SupabaseClient,
  planGroupId: string,
  date: string
): Promise<{ isExclusion: boolean; reason?: string; exclusionType?: string }>
```

### 적용 함수
- `movePlanToDate()`
- `movePlansToDate()`
- `movePlanToContainer()`
- `handlePlanDrop()`
- `moveAdHocPlan()`
- `rescheduleOnDrop()`

---

## 3. 시간 충돌 검증 추가 (HIGH)

### 파일
`lib/domains/plan/actions/move.ts`

### 헬퍼 함수
```typescript
function checkTimeOverlap(startA, endA, startB, endB): boolean

async function checkTimeConflict(
  supabase: SupabaseClient,
  studentId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludePlanId?: string
): Promise<{ hasConflict: boolean; conflictingPlan?: PlanInfo }>
```

### 적용
- `movePlanToDate()`에서 `keepTime=true`일 때 자동 검사

---

## 4. resizePlanDuration 권한 체크 개선 (MEDIUM)

### 파일
`lib/domains/plan/actions/calendarDrag.ts`

### 개선 내용
- `student_plan`: `plan_groups.student_id`로 소유자 확인 (조인 쿼리)
- `ad_hoc_plans`: 직접 `student_id`로 소유자 확인
- 테이블별 분기 처리로 코드 명확성 향상

---

## 검증 결과

- **타입 체크**: ✅ 통과
- **테스트**: 985/986 통과 (1개 실패는 기존 날짜 테스트 이슈)

---

---

## 5. 타이머 교차 타입 활성 체크 추가 (MEDIUM)

### 파일
`lib/domains/today/actions/timer.ts`

### 문제점
- `startPlan()`과 `resumePlan()`이 활성 `ad_hoc_plans`를 체크하지 않음
- 학생이 ad_hoc_plan 실행 중에도 student_plan 시작/재개 가능

### 수정 내용
```typescript
// [경합 방지 규칙 1-b] Ad-hoc 플랜 동시 실행 금지
const { data: activeAdHocPlans, error: adHocError } = await supabase
  .from("ad_hoc_plans")
  .select("id")
  .eq("student_id", user.userId)
  .eq("status", "in_progress");

if (activeAdHocPlans && activeAdHocPlans.length > 0) {
  return {
    success: false,
    error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
  };
}
```

### 적용 함수
- `startPlan()` - line 154-176
- `resumePlan()` - line 1002-1024

---

*마지막 업데이트: 2025-12-31*
