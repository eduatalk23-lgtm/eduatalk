# daily_schedule 캐싱 및 재계산 전략

## 개요

`daily_schedule`은 플랜 그룹의 일별 스케줄 정보를 저장하는 JSONB 필드입니다. 이 문서는 `daily_schedule`의 캐싱 전략과 재계산 로직에 대해 설명합니다.

## 데이터 구조

```typescript
type DailySchedule = Array<{
  date: string;                    // 날짜 (YYYY-MM-DD)
  day_type: string;                // 날짜 유형 (학습일, 복습일, 지정휴일, 휴가, 개인일정)
  study_hours: number;             // 학습 시간 (시간 단위)
  time_slots?: Array<{             // 시간 슬롯 (선택적)
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;                 // 시작 시간 (HH:mm)
    end: string;                   // 종료 시간 (HH:mm)
    label?: string;                // 라벨 (선택적)
  }>;
  exclusion?: {                    // 제외일 정보 (선택적)
    exclusion_type: string;
    reason?: string;
  } | null;
  academy_schedules?: Array<{       // 학원 일정 (선택적)
    academy_name?: string;
    subject?: string;
    start_time: string;
    end_time: string;
  }>;
}>;
```

## 캐싱 전략

### 1. 저장 시점

`daily_schedule`은 다음 시점에 저장됩니다:

1. **플랜 생성 시** (`_generatePlansFromGroup`):
   - `calculateAvailableDates` 호출 후 결과를 `daily_schedule`에 저장
   - 플랜 그룹의 `daily_schedule` 필드에 JSONB로 저장

2. **Step 7 조회 시** (`_getScheduleResultData`):
   - 재계산이 필요한 경우 계산 후 저장

### 2. 조회 전략

`_getScheduleResultData` 함수에서 `daily_schedule`을 조회할 때:

1. **저장된 데이터 우선 사용**
   - 저장된 `daily_schedule`이 있고 유효하면 우선 사용
   - 불필요한 재계산 방지로 성능 향상

2. **유효성 검증**
   - 기간 일치 여부 확인
   - 필수 필드 존재 여부 확인
   - 유효하지 않으면 재계산

3. **재계산 조건**
   - 저장된 데이터가 없을 때
   - 저장된 데이터가 유효하지 않을 때

## 재계산 로직

### 재계산 필요 여부 판단

`shouldRecalculateDailySchedule` 함수가 재계산 필요 여부를 판단합니다:

```typescript
function shouldRecalculateDailySchedule(group: {
  daily_schedule: any;
  period_start: string | null;
  period_end: string | null;
}): {
  shouldRecalculate: boolean;
  storedSchedule: DailySchedule | null;
}
```

**판단 기준**:
1. 저장된 `daily_schedule`이 없으면 재계산 필요
2. 유효성 검증 실패 시 재계산 필요
3. 그 외에는 저장된 데이터 사용

### 유효성 검증

`isValidDailySchedule` 함수가 저장된 `daily_schedule`의 유효성을 검증합니다:

**검증 항목**:
1. **배열 존재 여부**: `daily_schedule`이 배열이고 비어있지 않은지 확인
2. **기간 일치**: 저장된 스케줄의 첫 날짜와 마지막 날짜가 현재 기간과 일치하는지 확인
3. **필수 필드**: 각 항목에 `date`, `day_type`, `study_hours` 필드가 있는지 확인

**검증 실패 시**:
- 재계산이 필요함을 반환
- 콘솔에 실패 이유 로그 출력

## 에러 핸들링 및 폴백

### 제외일 조회 실패 시

제외일 조회가 실패하면 다음 폴백 로직을 사용합니다:

1. **저장된 daily_schedule에서 제외일 정보 추출**
   - 저장된 `daily_schedule`의 `exclusion` 필드에서 제외일 정보 추출
   - 재계산 없이 기존 정보 사용

2. **학원 일정 별도 조회**
   - `student_academy_schedules` 테이블에서 직접 조회 시도
   - 실패해도 계속 진행 (학원 일정이 없어도 스케줄 생성 가능)

### 에러 로깅

모든 에러는 콘솔에 로그로 출력되며, 폴백 로직이 적용됩니다:

```typescript
console.error("[planGroupActions] 제외일/학원일정 조회 실패, 폴백 로직 사용:", error);
```

## 성능 최적화

### 캐싱 효과

1. **재계산 방지**: 저장된 데이터가 유효하면 재계산하지 않음
2. **응답 시간 단축**: DB 조회 및 계산 시간 절약
3. **서버 부하 감소**: 불필요한 계산 작업 감소

### 주의사항

1. **옵션 변경 시**: `scheduler_options`가 변경되면 재계산이 필요할 수 있음
   - 현재는 유효성 검증만 수행
   - 향후 버전 관리 추가 예정 (TODO 4)

2. **제외일 변경 시**: 제외일이 변경되면 재계산이 필요함
   - 현재는 기간 일치만 확인
   - 향후 제외일 일치 여부 확인 추가 예정

## 사용 예시

### 저장된 데이터 사용

```typescript
const { shouldRecalculate, storedSchedule } = shouldRecalculateDailySchedule(group);

if (!shouldRecalculate && storedSchedule) {
  // 저장된 데이터 사용
  dailySchedule = storedSchedule;
} else {
  // 재계산 필요
  dailySchedule = await recalculateDailySchedule(...);
}
```

### 재계산

```typescript
const scheduleResult = calculateAvailableDates(
  periodStart,
  periodEnd,
  baseBlocks,
  filteredExclusions,
  academySchedules,
  schedulerOptions
);

dailySchedule = scheduleResult.daily_schedule.map((daily) => ({
  date: daily.date,
  day_type: daily.day_type,
  study_hours: daily.study_hours,
  time_slots: daily.time_slots,
  exclusion: daily.exclusion,
  academy_schedules: daily.academy_schedules,
}));

// 계산한 결과를 저장
await supabase
  .from("plan_groups")
  .update({ daily_schedule: dailySchedule })
  .eq("id", groupId);
```

## 향후 개선 사항

1. **버전 관리** (TODO 4):
   - `scheduler_options`에 버전 필드 추가
   - 옵션 변경 시 버전 비교하여 재계산 필요 여부 판단

2. **제외일 일치 확인**:
   - 저장된 `daily_schedule`의 제외일과 현재 제외일 비교
   - 불일치 시 재계산

3. **부분 업데이트**:
   - 변경된 날짜만 재계산
   - 전체 재계산 대신 부분 업데이트

## 관련 파일

- `app/(student)/actions/planGroupActions.ts`: `_getScheduleResultData` 함수
- `lib/scheduler/calculateAvailableDates.ts`: `daily_schedule` 계산 로직
- `lib/data/planGroups.ts`: 플랜 그룹 데이터 조회 함수

## 참고

- [Step 7 개선 TODO 리스트](./step7-improvement-todo.md)
- [Step 7 일별 스케줄 문제 분석](./step7-daily-schedule-issue-analysis.md)

