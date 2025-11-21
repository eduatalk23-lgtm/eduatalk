# Step 7 일별 스케줄 개선 TODO 리스트

## 작업 일시
2025-01-22

## 개선 목표

1. **즉시 수정**: 제외일 조회 버그 수정
2. **장기 개선**: 저장된 daily_schedule 우선 사용 및 재계산 최적화
3. **일관성 유지**: Step 3과 Step 7의 데이터 소스 통일

---

## Phase 1: 즉시 수정 (Critical)

### ✅ TODO 1: Step 7 제외일 조회 수정
**우선순위**: 🔴 Critical  
**예상 소요 시간**: 30분

**작업 내용**:
- `_getScheduleResultData` 함수의 제외일 조회 로직 수정
- `student_plan_exclusions` → `plan_exclusions` 테이블로 변경
- `plan_group_id`로 조회하도록 수정

**파일**: `app/(student)/actions/planGroupActions.ts` (3998-4003번 라인)

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
const { data: exclusions } = await supabase
  .from("plan_exclusions")  // ✅ 올바른 테이블
  .select("exclusion_date, exclusion_type, reason")
  .eq("plan_group_id", groupId)
  .gte("exclusion_date", group.period_start || "")
  .lte("exclusion_date", group.period_end || "");
```

---

### ✅ TODO 2: getPlanGroupWithDetails 사용으로 통일
**우선순위**: 🟡 High  
**예상 소요 시간**: 1시간

**작업 내용**:
- `_getScheduleResultData`에서 `getPlanGroupWithDetails` 사용
- 제외일 조회를 일관된 방식으로 통일
- 코드 중복 제거 및 유지보수성 향상

**파일**: `app/(student)/actions/planGroupActions.ts`

**변경 후**:
```typescript
// getPlanGroupWithDetails 사용
const { exclusions, academySchedules } = await getPlanGroupWithDetails(
  groupId,
  user.userId,
  tenantContext?.tenantId
);
```

**장점**:
- Step 3과 Step 7이 동일한 데이터 소스 사용
- 코드 중복 제거
- 유지보수성 향상

---

## Phase 2: 장기 개선 (Optimization)

### ✅ TODO 3: 저장된 daily_schedule 우선 사용 로직 개선
**우선순위**: 🟡 High  
**예상 소요 시간**: 2-3시간

**작업 내용**:
- 저장된 `daily_schedule`이 있으면 우선 사용
- 자율학습 옵션 변경 감지 메커니즘 추가
- 불필요한 재계산 방지

**현재 문제점**:
- 자율학습 옵션이 활성화되어 있으면 항상 재계산
- Step 3에서 이미 완벽하게 계산된 데이터를 무시

**개선 방안**:
```typescript
// 저장된 daily_schedule이 있고 유효하면 사용
if (
  group.daily_schedule &&
  Array.isArray(group.daily_schedule) &&
  group.daily_schedule.length > 0
) {
  // 유효성 검증
  const isValid = validateDailySchedule(
    group.daily_schedule,
    group.period_start,
    group.period_end,
    group.scheduler_options
  );
  
  if (isValid) {
    dailySchedule = group.daily_schedule;
  } else {
    // 유효하지 않으면 재계산
    dailySchedule = await recalculateDailySchedule(...);
  }
} else {
  // 저장된 데이터가 없으면 재계산
  dailySchedule = await recalculateDailySchedule(...);
}
```

---

### ✅ TODO 4: scheduler_options 버전 관리 추가
**우선순위**: 🟢 Medium  
**예상 소요 시간**: 1-2시간

**작업 내용**:
- `scheduler_options`에 버전/타임스탬프 필드 추가
- 옵션 변경 시 버전 업데이트
- 저장된 `daily_schedule`과 옵션 버전 비교하여 재계산 필요 여부 판단

**구현 방안**:
```typescript
// scheduler_options 구조
{
  // ... 기존 옵션들 ...
  _version: number,  // 버전 번호
  _last_updated: string,  // 마지막 업데이트 시간
  _daily_schedule_version: number  // daily_schedule 생성 시 버전
}

// 재계산 필요 여부 판단
const needsRecalculation = 
  !group.daily_schedule ||
  (group.scheduler_options?._daily_schedule_version !== 
   group.scheduler_options?._version);
```

---

### ✅ TODO 5: Step 3과 Step 7 데이터 소스 통일
**우선순위**: 🟡 High  
**예상 소요 시간**: 2시간

**작업 내용**:
- Step 3과 Step 7이 동일한 방식으로 제외일 조회
- 공통 함수 생성하여 재사용
- 데이터 일관성 보장

**구현 방안**:
```typescript
// 공통 함수 생성
async function getExclusionsForSchedule(
  groupId: string,
  studentId: string,
  periodStart: string,
  periodEnd: string,
  tenantId?: string
): Promise<Exclusion[]> {
  // getPlanGroupWithDetails 사용
  const { exclusions } = await getPlanGroupWithDetails(
    groupId,
    studentId,
    tenantId
  );
  
  // 기간 필터링
  return exclusions.filter(
    (e) => e.exclusion_date >= periodStart && e.exclusion_date <= periodEnd
  );
}
```

---

## Phase 3: 품질 향상 (Quality)

### ✅ TODO 6: daily_schedule 유효성 검증 로직 추가
**우선순위**: 🟢 Medium  
**예상 소요 시간**: 1-2시간

**작업 내용**:
- 저장된 `daily_schedule`의 유효성 검증
- 기간 일치 여부 확인
- 제외일 일치 여부 확인
- 옵션 일치 여부 확인

**구현 방안**:
```typescript
function validateDailySchedule(
  dailySchedule: DailySchedule[],
  periodStart: string,
  periodEnd: string,
  schedulerOptions: any,
  exclusions: Exclusion[]
): boolean {
  // 1. 기간 확인
  const scheduleDates = dailySchedule.map((d) => d.date);
  const expectedDates = generateDateRange(periodStart, periodEnd);
  if (!arraysEqual(scheduleDates, expectedDates)) {
    return false;
  }
  
  // 2. 제외일 확인
  const exclusionDates = exclusions.map((e) => e.exclusion_date);
  const scheduleExclusionDates = dailySchedule
    .filter((d) => d.exclusion)
    .map((d) => d.date);
  if (!arraysEqual(exclusionDates, scheduleExclusionDates)) {
    return false;
  }
  
  // 3. 옵션 확인 (버전 기반)
  // ...
  
  return true;
}
```

---

### ✅ TODO 7: 재계산 조건 명확화 및 리팩토링
**우선순위**: 🟢 Medium  
**예상 소요 시간**: 2-3시간

**작업 내용**:
- 재계산 조건을 명확한 함수로 분리
- 조건별 주석 및 문서화
- 테스트 가능한 구조로 리팩토링

**구현 방안**:
```typescript
function shouldRecalculateDailySchedule(
  group: PlanGroup,
  hasSelfStudyOptions: boolean
): boolean {
  // 1. 저장된 데이터가 없으면 재계산
  if (!group.daily_schedule || group.daily_schedule.length === 0) {
    return true;
  }
  
  // 2. 옵션이 변경되었으면 재계산
  if (hasSelfStudyOptions && 
      group.scheduler_options?._daily_schedule_version !== 
      group.scheduler_options?._version) {
    return true;
  }
  
  // 3. 유효성 검증 실패 시 재계산
  if (!validateDailySchedule(...)) {
    return true;
  }
  
  // 그 외에는 저장된 데이터 사용
  return false;
}
```

---

### ✅ TODO 8: 제외일 조회 에러 핸들링 및 폴백
**우선순위**: 🟢 Medium  
**예상 소요 시간**: 1시간

**작업 내용**:
- 제외일 조회 실패 시 에러 핸들링
- 폴백 로직 추가 (저장된 daily_schedule의 exclusion 정보 사용)
- 사용자 경험 개선

**구현 방안**:
```typescript
let exclusions: Exclusion[] = [];

try {
  const { exclusions: fetchedExclusions } = await getPlanGroupWithDetails(
    groupId,
    user.userId,
    tenantId
  );
  exclusions = fetchedExclusions;
} catch (error) {
  console.error("[planGroupActions] 제외일 조회 실패", error);
  
  // 폴백: 저장된 daily_schedule에서 exclusion 정보 추출
  if (group.daily_schedule) {
    exclusions = group.daily_schedule
      .filter((d) => d.exclusion)
      .map((d) => ({
        exclusion_date: d.date,
        exclusion_type: d.exclusion!.exclusion_type,
        reason: d.exclusion!.reason,
      }));
  }
}
```

---

## Phase 4: 문서화 및 테스트 (Documentation & Testing)

### ✅ TODO 9: daily_schedule 캐싱 및 재계산 로직 문서화
**우선순위**: 🟢 Medium  
**예상 소요 시간**: 1-2시간

**작업 내용**:
- daily_schedule 캐싱 전략 문서화
- 재계산 조건 및 로직 설명
- 개발 가이드 업데이트

**문서 위치**:
- `docs/daily-schedule-caching-strategy.md`
- 개발 가이드에 섹션 추가

---

### ✅ TODO 10: 단위 테스트 작성
**우선순위**: 🟢 Medium  
**예상 소요 시간**: 3-4시간

**작업 내용**:
- daily_schedule 저장/조회 테스트
- 재계산 조건 테스트
- 유효성 검증 테스트
- 제외일 조회 테스트

**테스트 케이스**:
1. 저장된 daily_schedule 사용 테스트
2. 재계산 필요 시 재계산 테스트
3. 제외일 조회 실패 시 폴백 테스트
4. 유효성 검증 실패 시 재계산 테스트

---

## 우선순위 요약

### 🔴 Critical (즉시 수정)
- TODO 1: Step 7 제외일 조회 수정

### 🟡 High (단기 개선)
- TODO 2: getPlanGroupWithDetails 사용으로 통일
- TODO 3: 저장된 daily_schedule 우선 사용 로직 개선
- TODO 5: Step 3과 Step 7 데이터 소스 통일

### 🟢 Medium (장기 개선)
- TODO 4: scheduler_options 버전 관리 추가
- TODO 6: daily_schedule 유효성 검증 로직 추가
- TODO 7: 재계산 조건 명확화 및 리팩토링
- TODO 8: 제외일 조회 에러 핸들링 및 폴백
- TODO 9: 문서화
- TODO 10: 단위 테스트 작성

---

## 예상 총 소요 시간

- Phase 1 (즉시 수정): 1.5시간
- Phase 2 (장기 개선): 5-7시간
- Phase 3 (품질 향상): 4-6시간
- Phase 4 (문서화 및 테스트): 4-6시간

**총 예상 시간**: 14.5-20.5시간

---

## 참고 사항

1. **점진적 개선**: Phase별로 순차적으로 진행
2. **테스트 우선**: 각 Phase 완료 후 테스트 필수
3. **문서화**: 변경 사항은 즉시 문서화
4. **백워드 호환성**: 기존 데이터와의 호환성 유지

