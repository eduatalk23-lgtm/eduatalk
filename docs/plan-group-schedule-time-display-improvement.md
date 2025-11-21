# 플랜 그룹 상세 보기 스케줄 시간 표시 개선

## 작업 개요

플랜 그룹 상세 보기의 주차별 스케줄과 일별 스케줄에서 시간 표시를 개선했습니다.

## 작업 내용

### 1. 시간 포맷팅 함수 개선 (`lib/utils/formatNumber.ts`)

- **변경 전**: 소수점 2자리로 포맷팅 (예: `21.00`, `11.00`)
- **변경 후**: 소수점 첫 번째 자리까지만 표시하고, 필요없으면 제거 (예: `21`, `11`, `10.5`)
  - 정수인 경우 소수점 제거
  - 소수점 첫 번째 자리가 0이 아닌 경우에만 표시

```typescript
// 변경 전
export function formatNumber(value: number): string {
  return value.toFixed(2);
}

// 변경 후
export function formatNumber(value: number): string {
  const formatted = value.toFixed(1);
  // .0으로 끝나는 경우 정수로 표시
  if (formatted.endsWith(".0")) {
    return formatted.slice(0, -2);
  }
  return formatted;
}
```

### 2. 주차별 스케줄 개선 (`app/(student)/plan/group/[id]/_components/Step2_5DetailView.tsx`)

- **변경 전**: 자율학습 시간만 표시
  ```tsx
  {weekSelfStudyHours > 0 && (
    <div className="text-xs text-gray-600">
      자율학습 {formatNumber(weekSelfStudyHours)}시간
    </div>
  )}
  ```

- **변경 후**: 학습 시간과 자율학습 시간 모두 표시
  ```tsx
  <div className="flex items-center gap-3 text-xs text-gray-600">
    {weekStudyHours > 0 && (
      <span>학습 {formatNumber(weekStudyHours)}시간</span>
    )}
    {weekSelfStudyHours > 0 && (
      <span>자율학습 {formatNumber(weekSelfStudyHours)}시간</span>
    )}
  </div>
  ```

- **학습 시간 계산 로직 추가**: `time_slots`에서 "학습시간" 타입만 필터링하여 계산
- **자율학습 시간 계산 로직 유지**: 지정휴일은 `study_hours` 사용, 그 외는 `time_slots`에서 "자율학습" 타입 계산

### 3. 일별 스케줄 개선 (`app/(student)/plan/group/[id]/_components/Step2_5DetailView.tsx`)

- **변경 전**: `study_hours` (학습 시간 + 자율학습 시간 합계)만 표시
  ```tsx
  {day.study_hours > 0 && (
    <div className="mt-1 text-xs">{formatNumber(day.study_hours)}시간</div>
  )}
  ```

- **변경 후**: 학습 시간과 자율학습 시간을 구분해서 표시
  ```tsx
  <div className="mt-1 space-y-0.5 text-xs">
    {studyHours > 0 && (
      <div>학습 {formatNumber(studyHours)}시간</div>
    )}
    {selfStudyHours > 0 && (
      <div>자율 {formatNumber(selfStudyHours)}시간</div>
    )}
  </div>
  ```

- **시간 계산 로직**:
  - **지정휴일**: `study_hours`를 자율학습 시간으로 사용 (학습 시간 없음)
  - **일반 학습일/복습일**: 
    - 학습 시간: `time_slots`에서 "학습시간" 타입만 계산
    - 자율학습 시간: `time_slots`에서 "자율학습" 타입만 계산

## 수정된 파일

1. `lib/utils/formatNumber.ts` - 시간 포맷팅 함수 개선
2. `app/(student)/plan/group/[id]/_components/Step2_5DetailView.tsx` - 주차별/일별 스케줄 시간 표시 개선

## 사용자 요구사항 충족

✅ **주차별 스케줄에 학습 시간 표시 추가**: 자율학습 시간과 함께 학습 시간도 표시  
✅ **일별 스케줄에서 학습 시간과 자율학습 시간 구분 표시**: 합계가 아닌 개별 시간으로 표시  
✅ **시간 포맷팅 개선**: 소수점 첫 번째 자리까지만 표시하고, 필요없으면 제거

## 테스트 사항

- [ ] 주차별 스케줄에서 학습 시간과 자율학습 시간이 올바르게 표시되는지 확인
- [ ] 일별 스케줄에서 학습 시간과 자율학습 시간이 구분되어 표시되는지 확인
- [ ] 시간 포맷팅이 올바르게 작동하는지 확인 (정수는 소수점 제거, 소수점 첫 번째 자리만 표시)
- [ ] 지정휴일의 경우 자율학습 시간만 표시되는지 확인

## 날짜

2025-01-13

