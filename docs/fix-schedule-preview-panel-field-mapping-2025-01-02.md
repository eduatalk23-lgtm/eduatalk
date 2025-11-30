# 스케줄 미리보기 패널 필드 매핑 수정

## 작업 일자
2025-01-02

## 문제 상황
플랜 생성 시 스케줄 미리보기 영역에서 다음 값들이 제대로 표시되지 않음:
- 제외일: 빈 값으로 표시
- 학습일: 빈 값으로 표시  
- 총 학습 시간: "NaN"으로 표시
- 일별 학습 시간: "학습 없음"으로 표시

## 원인 분석
`SchedulePreviewPanel.tsx`에서 사용하는 필드명이 실제 `ScheduleSummary` 타입의 필드명과 일치하지 않음:

1. **제외일**: `result.summary.excluded_days` 사용 → 실제로는 `result.summary.total_exclusion_days`가 객체 형태
2. **학습일**: `result.summary.study_days` 사용 → 실제로는 `result.summary.total_study_days`
3. **총 학습 시간**: `result.summary.total_available_minutes` 사용 → 실제로는 `result.summary.total_study_hours` (시간 단위)
4. **일별 학습 시간**: `day.available_minutes` 사용 → 실제로는 `day.study_hours` (시간 단위)

## 수정 내용

### 1. 제외일 계산 수정
```typescript
// 수정 전
{result.summary.excluded_days}

// 수정 후
{result.summary.total_exclusion_days.휴가 + 
 result.summary.total_exclusion_days.개인사정 + 
 result.summary.total_exclusion_days.지정휴일}
```

### 2. 학습일 필드명 수정
```typescript
// 수정 전
{result.summary.study_days}

// 수정 후
{result.summary.total_study_days}
```

### 3. 총 학습 시간 필드명 및 계산 수정
```typescript
// 수정 전
{formatNumber(Math.round(result.summary.total_available_minutes / 60))}

// 수정 후
{formatNumber(Math.round(result.summary.total_study_hours))}
```

### 4. 일별 학습 시간 필드명 및 계산 수정
```typescript
// 수정 전
{day.available_minutes > 0
  ? `${Math.round(day.available_minutes / 60)}시간`
  : "학습 없음"}

// 수정 후
{day.study_hours > 0
  ? `${Math.round(day.study_hours)}시간`
  : "학습 없음"}
```

## 수정 파일
- `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

## 참고
- `ScheduleSummary` 타입 정의: `lib/scheduler/calculateAvailableDates.ts`
- `DailySchedule` 타입 정의: `lib/scheduler/calculateAvailableDates.ts`

