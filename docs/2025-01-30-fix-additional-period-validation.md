# 추가 기간 스케줄 검증 오류 수정

## 📋 개요

추가 기간이 설정된 경우, 스케줄 계산 시 추가 기간까지 포함하여 계산하지만 검증 단계에서는 원래 기간만 확인하여 "14개의 스케줄이 플랜 기간 밖에 있습니다" 오류가 발생하는 문제를 수정했습니다.

## 🔍 문제점

### 기존 문제
- **스케줄 계산**: `SchedulePreviewPanel`에서 `effectiveEndDate`를 사용하여 추가 기간까지 포함
- **검증 단계**: `validateDataConsistency`와 `syncWizardDataToCreationData`에서 원래 기간(`period_start` ~ `period_end`)만 확인
- **결과**: 추가 기간의 날짜들이 검증에 실패하여 에러 발생

### 원인
- 추가 기간이 설정되어도 검증 로직이 추가 기간을 고려하지 않음
- `daily_schedule`에 추가 기간 날짜가 포함되어 있지만, 검증 시 원래 기간 범위만 확인

## ✅ 수정 내용

### 1. `validateDataConsistency` 함수 수정

#### 수정 전
```typescript
// 2. daily_schedule과 period 일치 검증
if (wizardData.daily_schedule) {
  const invalidSchedules = wizardData.daily_schedule.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    const periodStart = new Date(wizardData.period_start);
    const periodEnd = new Date(wizardData.period_end);
    return scheduleDate < periodStart || scheduleDate > periodEnd;
  });
  // ...
}
```

#### 수정 후
```typescript
// 2. daily_schedule과 period 일치 검증
if (wizardData.daily_schedule) {
  const periodStart = new Date(wizardData.period_start);
  const periodEnd = new Date(wizardData.period_end);
  
  // 추가 기간이 있으면 유효한 기간 범위 확장
  let validStart = periodStart;
  let validEnd = periodEnd;
  
  if (wizardData.additional_period_reallocation) {
    const additionalStart = new Date(wizardData.additional_period_reallocation.period_start);
    const additionalEnd = new Date(wizardData.additional_period_reallocation.period_end);
    
    // 유효한 기간: 원래 기간 + 추가 기간
    validStart = periodStart < additionalStart ? periodStart : additionalStart;
    validEnd = periodEnd > additionalEnd ? periodEnd : additionalEnd;
  }
  
  const invalidSchedules = wizardData.daily_schedule.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate < validStart || scheduleDate > validEnd;
  });
  // ...
}
```

### 2. `syncWizardDataToCreationData` 함수 수정

#### 수정 전
```typescript
// 2. daily_schedule 유효성 검증 및 필터링
const validatedDailySchedule = wizardData.daily_schedule?.filter(
  (schedule) => {
    try {
      const scheduleDate = new Date(schedule.date);
      const periodStart = new Date(wizardData.period_start);
      const periodEnd = new Date(wizardData.period_end);

      return (
        scheduleDate >= periodStart &&
        scheduleDate <= periodEnd &&
        schedule.study_hours >= 0
      );
    } catch {
      return false;
    }
  }
);
```

#### 수정 후
```typescript
// 2. daily_schedule 유효성 검증 및 필터링
const periodStart = new Date(wizardData.period_start);
const periodEnd = new Date(wizardData.period_end);

// 추가 기간이 있으면 유효한 기간 범위 확장
let validStart = periodStart;
let validEnd = periodEnd;

if (wizardData.additional_period_reallocation) {
  const additionalStart = new Date(wizardData.additional_period_reallocation.period_start);
  const additionalEnd = new Date(wizardData.additional_period_reallocation.period_end);
  
  // 유효한 기간: 원래 기간 + 추가 기간
  validStart = periodStart < additionalStart ? periodStart : additionalStart;
  validEnd = periodEnd > additionalEnd ? periodEnd : additionalEnd;
}

const validatedDailySchedule = wizardData.daily_schedule?.filter(
  (schedule) => {
    try {
      const scheduleDate = new Date(schedule.date);

      return (
        scheduleDate >= validStart &&
        scheduleDate <= validEnd &&
        schedule.study_hours >= 0
      );
    } catch {
      return false;
    }
  }
);
```

## 🎯 수정 사항 상세

### 1. 유효 기간 범위 확장
- 추가 기간이 있는 경우, 원래 기간과 추가 기간을 모두 포함하는 범위로 확장
- `validStart`: 원래 시작일과 추가 기간 시작일 중 더 이른 날짜
- `validEnd`: 원래 종료일과 추가 기간 종료일 중 더 늦은 날짜

### 2. 일관성 유지
- 스케줄 계산과 검증이 동일한 기간 범위를 사용
- 추가 기간 날짜들이 정상적으로 검증 통과

## 📝 테스트 시나리오

### 시나리오 1: 추가 기간 설정
- **입력**: 
  - 학습 기간: 2025-01-01 ~ 2025-01-31
  - 추가 기간: 2025-02-01 ~ 2025-02-07
- **기대 결과**: 
  - 추가 기간 날짜들이 검증 통과
  - 에러 없이 저장 가능

### 시나리오 2: 추가 기간이 원래 기간과 겹치는 경우
- **입력**: 
  - 학습 기간: 2025-01-01 ~ 2025-01-31
  - 추가 기간: 2025-01-25 ~ 2025-02-07
- **기대 결과**: 
  - 겹치는 부분 포함하여 유효 범위 계산
  - 모든 날짜가 검증 통과

### 시나리오 3: 추가 기간이 원래 기간보다 앞서는 경우
- **입력**: 
  - 학습 기간: 2025-01-15 ~ 2025-01-31
  - 추가 기간: 2025-01-01 ~ 2025-01-14
- **기대 결과**: 
  - 유효 범위: 2025-01-01 ~ 2025-01-31
  - 모든 날짜가 검증 통과

## 🚀 배포 전 확인사항

1. [x] 추가 기간이 설정된 경우 검증 통과 확인
2. [x] 추가 기간이 없는 경우 기존 동작 유지 확인
3. [x] 추가 기간과 원래 기간이 겹치는 경우 처리 확인
4. [x] 저장 및 제출 시 에러 없이 동작 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `lib/utils/planGroupDataSync.ts`

