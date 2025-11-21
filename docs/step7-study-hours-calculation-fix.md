# Step 7 학습 시간 계산 수정

## 작업 일시

2025-01-22

## 문제점

Step 7에서 "학습 시간: 11.00시간"이 자율학습 시간을 포함하여 계산되고 있었습니다. 순수 학습 시간만 표시되어야 합니다.

## 해결 방법

### 1. 일별 학습 시간 계산 수정

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

**변경 전**:

```typescript
학습 시간: {formatNumber(schedule.study_hours)}시간
```

**변경 후**:

```typescript
// 순수 학습 시간: time_slots에서 "학습시간" 타입만 계산
const studyHours = calculateTimeFromSlots("학습시간");
학습 시간: {formatNumber(studyHours)}시간
```

### 2. 주차별 총 시간 계산 수정

주차별 총 시간도 순수 학습 시간만 계산하도록 수정했습니다.

**변경 전**:

```typescript
const weekTotalHours = schedules.reduce((sum, s) => sum + s.study_hours, 0);
```

**변경 후**:

```typescript
// 주차별 순수 학습 시간 계산 (time_slots에서 "학습시간" 타입만)
const weekTotalHours = schedules.reduce((sum, s) => {
  // 지정휴일은 학습 시간이 없으므로 제외
  if (s.day_type === "지정휴일") return sum;
  if (!s.time_slots) return sum;
  const studyMinutes = s.time_slots
    .filter((slot) => slot.type === "학습시간")
    .reduce((slotSum, slot) => {
      const [startHour, startMin] = slot.start.split(":").map(Number);
      const [endHour, endMin] = slot.end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return slotSum + (endMinutes - startMinutes);
    }, 0);
  return sum + studyMinutes / 60;
}, 0);
```

## 계산 로직

### 시간 슬롯 타입별 계산

- **학습 시간**: `time_slots`에서 `type === "학습시간"`인 슬롯들의 시간 합계
- **자율 학습 시간**: `time_slots`에서 `type === "자율학습"`인 슬롯들의 시간 합계
- **이동 시간**: `time_slots`에서 `type === "이동시간"`인 슬롯들의 시간 합계
- **학원 시간**: `time_slots`에서 `type === "학원일정"`인 슬롯들의 시간 합계

### 지정휴일 처리

- 지정휴일의 경우 `study_hours`가 자율학습 시간을 의미하므로, 학습 시간은 0으로 처리됩니다.

## 결과

이제 Step 7에서:

- ✅ **학습 시간**: 순수 학습 시간만 표시 (자율학습 시간 제외)
- ✅ **자율 학습 시간**: 별도로 표시
- ✅ **주차별 총 시간**: 순수 학습 시간만 계산

각 항목별로 정확한 시간이 표시됩니다.
