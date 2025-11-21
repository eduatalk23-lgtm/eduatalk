# Step7에서 자율학습 시간 배정 누락 문제 수정

## 문제 상황

3단계(Step 2.5)에서 도출된 자율학습 배정이 7단계(Step 7)에서 빠져있는 문제가 있었습니다.

### 문제점

1. **옵션 전달 누락**: `getScheduleResultDataAction`에서 `calculateAvailableDates`를 호출할 때 자율학습 시간 배정 옵션(`enable_self_study_for_holidays`, `enable_self_study_for_study_days`)이 전달되지 않음
2. **자율학습 시간 미계산**: Step 7에서 스케줄 결과를 조회할 때 자율학습 시간이 제대로 계산되지 않음
3. **표시 누락**: Step 7의 `ScheduleTableView`에서 자율학습 시간이 표시되지 않음

## 수정 내용

### `getScheduleResultDataAction` 수정

`calculateAvailableDates` 호출 시 자율학습 시간 배정 옵션을 전달하도록 수정했습니다.

**수정 전:**
```typescript
{
  scheduler_type: (group.scheduler_type || "자동스케줄러") as "1730_timetable" | "자동스케줄러",
  scheduler_options: group.scheduler_options || null,
  use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
}
```

**수정 후:**
```typescript
{
  scheduler_type: (group.scheduler_type || "자동스케줄러") as "1730_timetable" | "자동스케줄러",
  scheduler_options: group.scheduler_options || null,
  use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
  enable_self_study_for_holidays: (group.scheduler_options as any)?.enable_self_study_for_holidays === true,
  enable_self_study_for_study_days: (group.scheduler_options as any)?.enable_self_study_for_study_days === true,
  lunch_time: (group.scheduler_options as any)?.lunch_time,
  camp_study_hours: (group.scheduler_options as any)?.camp_study_hours,
  camp_self_study_hours: (group.scheduler_options as any)?.camp_self_study_hours,
  designated_holiday_hours: (group.scheduler_options as any)?.designated_holiday_hours,
}
```

## 동작 방식

### Step 2.5 (스케줄 미리보기)
- `calculateScheduleAvailability`를 통해 스케줄 가능 날짜 계산
- 자율학습 시간 배정 옵션이 전달되어 `time_slots`에 자율학습 시간 포함
- `schedule_summary`에 `total_self_study_hours` 저장

### Step 7 (스케줄 결과)
- `getScheduleResultDataAction`을 통해 스케줄 결과 조회
- 저장된 `daily_schedule`이 있으면 사용, 없으면 재계산
- 재계산 시 자율학습 시간 배정 옵션을 전달하여 `time_slots`에 자율학습 시간 포함
- `ScheduleTableView`에서 `time_slots`의 자율학습 시간을 계산하여 표시

## 영향 범위

- ✅ Step 7 스케줄 결과 조회 (`getScheduleResultDataAction`)
- ✅ Step 7 스케줄 테이블 표시 (`ScheduleTableView`)
- ✅ 주차별 자율학습 시간 통계
- ✅ 일별 자율학습 시간 표시

## 테스트 시나리오

1. **지정휴일 자율학습 시간 배정**
   - Step 2에서 "지정휴일 자율학습 시간 배정하기" 토글 활성화
   - Step 2.5에서 지정휴일에 자율학습 시간 표시 확인
   - Step 7에서도 지정휴일에 자율학습 시간 표시 확인

2. **학습일/복습일 자율학습 시간 배정**
   - Step 2에서 "학습일/복습일 자율학습 시간 배정하기" 토글 활성화
   - Step 2.5에서 학습일/복습일에 자율학습 시간 표시 확인
   - Step 7에서도 학습일/복습일에 자율학습 시간 표시 확인

3. **토글 비활성화**
   - Step 2에서 자율학습 시간 배정 토글 비활성화
   - Step 2.5에서 자율학습 시간이 표시되지 않음 확인
   - Step 7에서도 자율학습 시간이 표시되지 않음 확인

## 관련 파일

- `app/(student)/actions/planGroupActions.ts` - `_getScheduleResultData` 함수
- `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx` - 스케줄 테이블 표시
- `lib/scheduler/calculateAvailableDates.ts` - 스케줄 가능 날짜 계산

## 날짜

- 2025-01-XX: Step 7에서 자율학습 시간 배정 누락 문제 수정

