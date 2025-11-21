# Step3 스케줄 확인 - 자율학습 시간 표기 추가

## 작업 일자
2025-01-XX

## 수정 이력
- 2025-01-XX: 지정휴일에서 학습시간과 자율학습 시간 중복 계산 문제 수정

## 작업 내용

### 요구사항
Step3 스케줄 확인 페이지의 일별 스케줄에 자율학습 시간을 추가로 표기하고, 이동시간과 학원 시간도 함께 표기하도록 개선

### 수정 파일
- `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx`

### 주요 변경사항

#### 1. 주차별 통계에 자율학습 시간 추가
- `WeekSection` 컴포넌트에서 주차별 자율학습 시간 계산 로직 추가
- 주차별 통계에 "자율학습 X시간" 표기 추가
- `time_slots`에서 "자율학습" 타입의 시간 슬롯을 합산하여 계산

```typescript
// 주차별 자율학습 시간 계산
const weekSelfStudyHours = schedules.reduce((sum, s) => {
  if (!s.time_slots) return sum;
  const selfStudyMinutes = s.time_slots
    .filter((slot) => slot.type === "자율학습")
    .reduce((slotSum, slot) => {
      const [startHour, startMin] = slot.start.split(":").map(Number);
      const [endHour, endMin] = slot.end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return slotSum + (endMinutes - startMinutes);
    }, 0);
  return sum + selfStudyMinutes / 60;
}, 0);
```

#### 2. 일별 스케줄에 자율학습/이동/학원 시간 표기 추가
- `ScheduleItem` 컴포넌트에 시간 계산 헬퍼 함수 추가
- 학습 시간, 자율 학습 시간, 이동시간, 학원 시간을 별도로 표기
- 시간대 표시(available_time_ranges) 제거

```typescript
// 시간 슬롯에서 각 타입별 시간 계산 (시간 단위)
const calculateTimeFromSlots = (type: "자율학습" | "이동시간" | "학원일정"): number => {
  if (!schedule.time_slots) return 0;
  const minutes = schedule.time_slots
    .filter((slot) => slot.type === type)
    .reduce((sum, slot) => {
      const [startHour, startMin] = slot.start.split(":").map(Number);
      const [endHour, endMin] = slot.end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return sum + (endMinutes - startMinutes);
    }, 0);
  return minutes / 60;
};
```

#### 3. UI 개선
- 일별 스케줄 항목에서 시간 정보를 더 명확하게 표시
- 학습 시간과 자율 학습 시간을 한 줄에 표시
- 이동시간과 학원 시간이 있는 경우에만 별도 줄에 표시
- 시간대 표시(10:00~12:00, 13:00~19:00) 제거

### 표시 형식

#### 주차별 통계
```
1주차 2026-01-03 ~ 2026-01-09
학습일 6일 복습일 1일 총 56.00시간 자율학습 3.00시간
```

#### 일별 스케줄
```
2026-01-03 (토) [학습일]
학습 시간: 8.00시간 자율 학습 시간: 0시간
이동시간: 1.00시간 학원 시간: 2.00시간
```

### 기술적 세부사항
- `time_slots` 배열에서 각 타입별 시간 슬롯을 필터링하여 시간 계산
- 시간 문자열(HH:mm)을 분 단위로 변환 후 시간 단위로 재변환
- `formatNumber` 유틸리티 함수를 사용하여 소수점 표기 통일

## 버그 수정: 지정휴일 중복 계산 문제

### 문제점
지정휴일의 경우 학습시간이 자율학습으로 변환되는데, `study_hours`와 `time_slots`에서 자율학습 시간을 별도로 계산하여 중복이 발생했습니다.

### 해결 방법
1. **주차별 통계**: 지정휴일인 경우 `study_hours`를 자율학습 시간으로 간주하고, 별도로 계산하지 않음
2. **일별 스케줄**: 지정휴일인 경우 학습 시간을 표기하지 않고 자율학습 시간만 표기
3. **일반 학습일/복습일**: 학습 시간과 자율학습 시간을 별도로 표기

### 수정 코드
```typescript
// 지정휴일인 경우 study_hours가 자율학습 시간이므로 별도 계산 불필요
const isDesignatedHoliday = schedule.day_type === "지정휴일";
const selfStudyHours = isDesignatedHoliday 
  ? schedule.study_hours 
  : calculateTimeFromSlots("자율학습");
```

### 표시 형식 (수정 후)

#### 지정휴일
```
2026-01-03 (토) [지정휴일]
자율 학습 시간: 6.00시간
```

#### 일반 학습일/복습일
```
2026-01-03 (토) [학습일]
학습 시간: 8.00시간 자율 학습 시간: 0시간
이동시간: 1.00시간 학원 시간: 2.00시간
```

