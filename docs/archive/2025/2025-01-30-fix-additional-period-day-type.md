# Step3 추가 기간 날짜 타입 수정

## 📋 개요

Step3(스케줄 미리보기)에서 추가 기간이 설정된 경우, 텍스트로는 "복습일로 계산됨"이라고 안내하고 있지만 실제 총계 및 주차별 스케줄에서는 "학습일"로 표시되는 불일치 문제를 수정했습니다.

## 🔍 문제점

### 기존 문제
- **텍스트 안내**: "추가 기간: YYYY-MM-DD ~ YYYY-MM-DD (복습일로 계산됨)"
- **실제 표시**: 추가 기간의 날짜들이 "학습일"로 표시됨
- **총계 통계**: 추가 기간 날짜들이 학습일로 카운트됨

### 원인
- `calculateAvailableDates` 함수가 추가 기간 정보를 받지 않음
- 추가 기간 날짜들도 일반 기간과 동일하게 학습일/복습일 주기로 분류됨
- 추가 기간 날짜들이 학습일로 분류되어 통계에 반영됨

## ✅ 수정 내용

### `SchedulePreviewPanel.tsx` - 추가 기간 날짜 타입 변경

#### 수정 전
```typescript
const result = calculatedResult.data;

// 캐시 저장
scheduleCache.set(params, result);

setResult(result);
```

#### 수정 후
```typescript
let result = calculatedResult.data;

// 추가 기간이 있으면 해당 날짜들을 복습일로 변경
if (data.additional_period_reallocation) {
  const additionalStart = data.additional_period_reallocation.period_start;
  const additionalEnd = data.additional_period_reallocation.period_end;
  
  // daily_schedule에서 추가 기간 날짜들의 day_type을 복습일로 변경
  const updatedDailySchedule = result.daily_schedule.map((day) => {
    if (
      day.date >= additionalStart &&
      day.date <= additionalEnd &&
      day.day_type !== "휴가" &&
      day.day_type !== "개인일정" &&
      day.day_type !== "지정휴일"
    ) {
      return {
        ...day,
        day_type: "복습일" as const,
      };
    }
    return day;
  });
  
  // 통계 재계산
  let totalStudyDays = 0;
  let totalReviewDays = 0;
  let totalStudyHours_학습일 = 0;
  let totalStudyHours_복습일 = 0;
  
  for (const day of updatedDailySchedule) {
    // 학습 시간 계산: timeSlots에서 "학습시간" 타입만 계산
    const studyHoursOnly = (day.time_slots || [])
      .filter((slot) => slot.type === "학습시간")
      .reduce((sum, slot) => {
        const [startHour, startMin] = slot.start.split(":").map(Number);
        const [endHour, endMin] = slot.end.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return sum + (endMinutes - startMinutes) / 60;
      }, 0);
    
    if (day.day_type === "학습일") {
      totalStudyDays++;
      totalStudyHours_학습일 += studyHoursOnly;
    } else if (day.day_type === "복습일") {
      totalReviewDays++;
      totalStudyHours_복습일 += studyHoursOnly;
    }
  }
  
  // summary 업데이트
  result = {
    ...result,
    daily_schedule: updatedDailySchedule,
    summary: {
      ...result.summary,
      total_study_days: totalStudyDays,
      total_review_days: totalReviewDays,
      total_study_hours_학습일: totalStudyHours_학습일,
      total_study_hours_복습일: totalStudyHours_복습일,
    },
  };
}
```

## 🎯 수정 사항 상세

### 1. 추가 기간 날짜 타입 변경
- 추가 기간 내의 모든 날짜를 "복습일"로 변경
- 단, 제외일(휴가, 개인일정, 지정휴일)은 변경하지 않음

### 2. 통계 재계산
- 학습일/복습일 카운트 재계산
- 학습 시간 통계 재계산 (학습일/복습일별)
- 추가 기간 날짜들이 복습일로 정확히 카운트됨

### 3. 일관성 유지
- 텍스트 안내와 실제 표시가 일치
- 총계 통계와 주차별 스케줄이 일치

## 📝 테스트 시나리오

### 시나리오 1: 추가 기간 설정
- **입력**: 
  - 학습 기간: 2025-01-01 ~ 2025-01-31
  - 추가 기간: 2025-02-01 ~ 2025-02-07
- **기대 결과**: 
  - 추가 기간 안내: "(복습일로 계산됨)"
  - 추가 기간 날짜들: 모두 "복습일"로 표시
  - 총계: 추가 기간 날짜들이 복습일로 카운트

### 시나리오 2: 추가 기간에 제외일 포함
- **입력**: 
  - 추가 기간: 2025-02-01 ~ 2025-02-07
  - 제외일: 2025-02-03 (휴가)
- **기대 결과**: 
  - 2025-02-03은 "휴가"로 유지 (복습일로 변경되지 않음)
  - 나머지 날짜들은 "복습일"로 표시

## 🚀 배포 전 확인사항

1. [x] Step3 스케줄 미리보기에서 추가 기간 날짜들이 복습일로 표시되는지 확인
2. [x] 총계 통계에서 추가 기간 날짜들이 복습일로 카운트되는지 확인
3. [x] 주차별 스케줄에서 추가 기간 날짜들이 복습일로 표시되는지 확인
4. [x] 제외일이 있는 경우 올바르게 처리되는지 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

