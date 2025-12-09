# 학원 일정 카운팅 로직 개선

## 작업 일자
2024-12-09

## 목표
학원 일정 통계를 요일별 개별 카운트가 아닌 **학원 단위**로 측정하도록 개선했습니다. 기존에는 같은 학원이 여러 요일에 있으면 각 요일을 별도로 카운트하여 통계가 부정확하게 표시되는 문제가 있었습니다.

## 변경 사항

### 1. `groupAcademySchedules` 함수 개선

**파일**: `lib/scheduler/calculateAvailableDates.ts` (323-427줄)

**변경 내용**:
- 그룹화 키를 `academy_name`만 사용하도록 변경 (과목 무시)
- 여러 과목이 있어도 하나의 학원으로 집계
- `total_count`를 고유 요일 수 기준으로 계산 (기간 내 해당 요일의 날짜 수 합산)
- 과목 목록을 쉼표로 구분된 문자열로 변환하여 표시

**변경 전**:
```typescript
const key = `${schedule.academy_name || ""}_${schedule.subject || ""}`;
// 학원명+과목 기준으로 그룹화
```

**변경 후**:
```typescript
const key = schedule.academy_name || "학원";
// 학원명만으로 그룹화
```

### 2. `totalAcademySchedules` 계산 개선

**파일**: `lib/scheduler/calculateAvailableDates.ts` (1026-1152줄)

**변경 내용**:
- 기존: 각 날짜마다 `dateAcademySchedules.length`를 누적
- 변경: `academyGroups`의 `total_count` 합산으로 계산
- 학원 단위 일정 수로 정확하게 집계

**변경 전**:
```typescript
if (dateAcademySchedules.length > 0) {
  totalAcademySchedules += dateAcademySchedules.length;
  // ...
}
```

**변경 후**:
```typescript
// 학원 단위 일정 수 계산 (academyGroups의 total_count 합산)
// total_count는 각 학원의 고유 요일 수 기준으로 계산된 값
const totalAcademySchedules = academyGroups.reduce((sum, group) => sum + group.total_count, 0);
```

### 3. 주석 및 타입 정의 업데이트

**변경 내용**:
- `total_academy_schedules` 주석을 "총 학원일정 횟수" → "학원 단위 일정 수 (고유 요일 기준)"로 명확화
- `AcademyGroup` 타입에 `total_count` 계산 방식 주석 추가
- `averageTravelTime` 계산 로직에 주석 추가

## 개선 효과

### 변경 전 문제점
- 학원A가 월요일, 수요일에 있으면 → 각 요일을 별도로 카운트하여 통계가 부정확
- 학원A-수학, 학원A-영어가 있으면 → 별도 그룹으로 분리되어 통계가 중복

### 변경 후 개선점
- 학원A가 월요일, 수요일에 있어도 → 1개 학원으로 집계
- 학원A-수학, 학원A-영어가 있어도 → 1개 학원으로 집계 (과목은 쉼표로 구분하여 표시)
- 통계가 학원 단위로 정확하게 표시됨

## 영향 범위

### 영향 없는 부분
- 타임 슬롯 생성 로직 (`generateTimeSlots`): 기존대로 요일별로 처리되므로 영향 없음
- 일별 스케줄 계산: 기존 로직 유지

### 확인 필요 부분
- `academy_groups`를 사용하는 UI 컴포넌트
- `total_academy_schedules`를 표시하는 통계 대시보드
- 통계 표시가 변경된 값에 맞게 업데이트되는지 확인

## 테스트 케이스

1. **단일 학원, 단일 요일**
   - 학원A가 월요일에만 있음
   - 결과: 1개 학원, total_count = 월요일 날짜 수

2. **단일 학원, 여러 요일**
   - 학원A가 월요일, 수요일에 있음
   - 결과: 1개 학원, total_count = 월요일 날짜 수 + 수요일 날짜 수

3. **단일 학원, 여러 과목**
   - 학원A-수학이 월요일에, 학원A-영어가 수요일에 있음
   - 결과: 1개 학원 (subject: "수학, 영어"), total_count = 월요일 날짜 수 + 수요일 날짜 수

4. **여러 학원**
   - 학원A가 월요일에, 학원B가 수요일에 있음
   - 결과: 2개 학원, 각각의 total_count 합산

## 참고 사항

- `total_count`는 각 학원의 고유 요일 수 기준으로 계산됩니다
- 여러 과목이 있어도 하나의 학원으로 집계되며, 과목은 쉼표로 구분하여 표시됩니다
- `total_academy_hours`와 `total_travel_hours`는 기존대로 각 일정의 시간을 합산합니다

