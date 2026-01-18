# Step3 스케줄 확인 학습시간 계산 개선 가이드

## 📋 개요

Step3 스케줄 확인의 일별 스케줄에서 학습시간 계산 로직을 개선하여, 순수 학습시간과 자율학습 시간을 명확히 구분하여 표시하도록 수정했습니다.

## 🔍 문제점

### 기존 문제
- **순수 학습시간 + 자율학습 시간을 합쳐서 학습시간으로 표시**
- 자율학습 시간도 별도로 표시되어 **중복 표시** 발생
- 예시: `학습 시간: 8시간 자율 학습 시간: 2시간` (실제로는 학습시간 6시간 + 자율학습 2시간이었음)

### 원인
- `schedule.study_hours` 값이 이미 자율학습 시간을 포함하고 있음
- `time_slots`에서 "학습시간" 타입만 계산하지 않고 전체 `study_hours`를 사용

## ✅ 수정 내용

### 1. `Step2_5SchedulePreview.tsx` - `ScheduleItem` 컴포넌트

#### 수정 전
```typescript
const calculateTimeFromSlots = (type: "자율학습" | "이동시간" | "학원일정"): number => {
  // "학습시간" 타입 처리 불가
}

// schedule.study_hours 직접 사용 (자율학습 시간 포함)
학습 시간: {formatNumber(schedule.study_hours)}시간
```

#### 수정 후
```typescript
const calculateTimeFromSlots = (type: "학습시간" | "자율학습" | "이동시간" | "학원일정"): number => {
  // "학습시간" 타입 처리 추가
}

// 순수 학습 시간: time_slots에서 "학습시간" 타입만 계산
const studyHours = calculateTimeFromSlots("학습시간");
학습 시간: {formatNumber(studyHours)}시간
```

### 2. `Step2_5SchedulePreview.tsx` - `WeekSection` 컴포넌트

#### 수정 전
```typescript
// schedule.study_hours 직접 사용 (자율학습 시간 포함)
const weekTotalHours = schedules.reduce((sum, s) => sum + s.study_hours, 0);
```

#### 수정 후
```typescript
// 주차별 순수 학습 시간 계산 (time_slots에서 "학습시간" 타입만)
const weekTotalHours = schedules.reduce((sum, s) => {
  // 지정휴일은 학습 시간이 없으므로 제외
  if (s.day_type === "지정휴일") return sum;
  if (!s.time_slots) return sum;
  const studyMinutes = s.time_slots
    .filter((slot) => slot.type === "학습시간")
    .reduce((slotSum, slot) => {
      // 시간 계산 로직
    }, 0);
  return sum + studyMinutes / 60;
}, 0);
```

## 📊 수정 결과

### 표시 형식

#### 일반 학습일/복습일
```
학습 시간: 6시간 자율 학습 시간: 2시간
```
- **학습 시간**: 순수 학습시간만 표시 (time_slots의 "학습시간" 타입)
- **자율 학습 시간**: 자율학습 시간만 별도 표시 (time_slots의 "자율학습" 타입)

#### 지정휴일
```
자율 학습 시간: 3시간
```
- 지정휴일은 학습 시간이 없으므로 자율학습 시간만 표시

### 주차별 요약
```
1주차 2024-01-01 ~ 2024-01-07
학습일 5일 복습일 1일 제외일 1일 총 30시간 자율학습 10시간
```
- **총 시간**: 순수 학습시간만 계산
- **자율학습 시간**: 자율학습 시간만 별도 계산

## 🔄 참고: `ScheduleTableView.tsx`

`ScheduleTableView.tsx`는 이미 올바르게 구현되어 있었습니다:
- 라인 308: `const studyHours = calculateTimeFromSlots("학습시간");` - 순수 학습시간만 계산
- 라인 1012-1026: 주차별 순수 학습 시간 계산도 올바르게 구현됨

## ✅ 체크리스트

### 수정 완료 항목
- [x] `Step2_5SchedulePreview.tsx`의 `ScheduleItem` 컴포넌트 수정
  - [x] `calculateTimeFromSlots` 함수에 "학습시간" 타입 추가
  - [x] `schedule.study_hours` 대신 `calculateTimeFromSlots("학습시간")` 사용
- [x] `Step2_5SchedulePreview.tsx`의 `WeekSection` 컴포넌트 수정
  - [x] 주차별 총 학습시간 계산 시 순수 학습시간만 계산
  - [x] 지정휴일 제외 로직 추가

### 확인 완료 항목
- [x] `ScheduleTableView.tsx`는 이미 올바르게 구현되어 있음
- [x] 캠프 템플릿 관련 파일은 별도 수정 불필요 (플랜 그룹 생성 시 동일한 컴포넌트 사용)

## 🎯 고려사항

### 1. 데이터 구조
- `schedule.study_hours`: 전체 학습 가능 시간 (자율학습 시간 포함 가능)
- `schedule.time_slots`: 시간 슬롯 배열
  - `type: "학습시간"`: 순수 학습시간
  - `type: "자율학습"`: 자율학습 시간
  - `type: "점심시간"`, `"학원일정"`, `"이동시간"`: 기타 시간

### 2. 지정휴일 처리
- 지정휴일의 경우 `study_hours`가 자율학습 시간을 나타냄
- 학습 시간은 없으므로 별도 계산 불필요

### 3. 일관성 유지
- 모든 스케줄 표시 컴포넌트에서 동일한 계산 로직 사용
- `ScheduleTableView.tsx`와 동일한 패턴 적용

## 📝 테스트 시나리오

### 시나리오 1: 일반 학습일
- **입력**: 학습시간 6시간, 자율학습 시간 2시간
- **기대 결과**: 
  - 학습 시간: 6시간
  - 자율 학습 시간: 2시간

### 시나리오 2: 지정휴일
- **입력**: 자율학습 시간 3시간
- **기대 결과**: 
  - 자율 학습 시간: 3시간
  - 학습 시간 표시 없음

### 시나리오 3: 주차별 요약
- **입력**: 학습일 5일 (각 6시간), 자율학습 2시간/일
- **기대 결과**: 
  - 총 30시간 (순수 학습시간만)
  - 자율학습 10시간 (자율학습 시간만)

## 🚀 배포 전 확인사항

1. [ ] Step3 스케줄 확인 화면에서 학습시간과 자율학습 시간이 올바르게 구분되어 표시되는지 확인
2. [ ] 주차별 요약에서도 올바르게 계산되는지 확인
3. [ ] 지정휴일 처리도 올바르게 동작하는지 확인
4. [ ] 기존 데이터와의 호환성 확인

---

**수정일**: 2024-11-23  
**수정 파일**: 
- `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx`









