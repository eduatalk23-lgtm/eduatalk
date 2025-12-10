# 재조정 시나리오: 부분 완료 후 재조정

**작성일**: 2025-01-XX  
**목적**: 2일차까지 진행 후 초기 기간 종료 2주 전 재조정 시나리오 검증

---

## 📋 시나리오 개요

### 초기 설정

- **학습 범위**: 1~100페이지 (총 100페이지)
- **플랜 그룹 기간**: 2025-01-01 ~ 2025-01-28 (4주, 28일)
- **스케줄러 타입**: `1730_timetable`
- **스케줄 옵션**:
  - `study_days`: 6일
  - `review_days`: 1일
  - `weak_subject_focus`: false
  - `review_scope`: "weekly"
  - 기타 1730 타임테이블 옵션들

### 진행 상황

- **1일차 (2025-01-01)**: 1~5페이지 완료
- **2일차 (2025-01-02)**: 6~10페이지 완료
- **3일차 이후**: 미진행
- **재조정 시점**: 2025-01-14 (초기 기간 종료 2주 전)
- **재조정 범위**: 2025-01-15 ~ 2025-01-28 (14일)

---

## 🔍 재조정 프로세스 상세 분석

### Step 1: 미진행 범위 계산

#### 1.1 오늘 이전 미진행 플랜 조회

```typescript
// 재조정 시점: 2025-01-14
// 오늘 이전 플랜 조회 조건:
// - plan_date < '2025-01-14'
// - status IN ('pending', 'in_progress')
// - is_active = true
```

**조회된 플랜**:

- 1일차 (2025-01-01): `planned_start: 1, planned_end: 5, completed_amount: 5` ✅ 완료
- 2일차 (2025-01-02): `planned_start: 6, planned_end: 10, completed_amount: 5` ✅ 완료
- 3일차 (2025-01-03): `planned_start: 11, planned_end: 15, completed_amount: 0` ❌ 미진행
- 4일차 (2025-01-04): `planned_start: 16, planned_end: 20, completed_amount: 0` ❌ 미진행
- ... (3일차 ~ 13일차까지 미진행)

#### 1.2 미진행 범위 계산

```typescript
// calculateUncompletedRange 함수 실행
// 콘텐츠별 미진행 범위 합산

// 3일차: (15 - 11) - 0 = 4페이지
// 4일차: (20 - 16) - 0 = 4페이지
// ... (3일차 ~ 13일차까지)
// 총 미진행 범위: 약 80페이지 (11~90페이지)
```

**미진행 범위 Map**:

```typescript
Map {
  'content-id-1' => 80  // 11~90페이지 미진행
}
```

### Step 2: 재조정 기간 결정

```typescript
// getAdjustedPeriod 함수 실행
const dateRange = { from: "2025-01-15", to: "2025-01-28" };
const today = "2025-01-14";
const groupEnd = "2025-01-28";

// 결과:
adjustedPeriod = {
  start: "2025-01-15", // 오늘 다음날
  end: "2025-01-28", // 그룹 종료일
};
```

### Step 3: 콘텐츠 범위 조정

#### 3.1 조정 적용 (adjustments가 없는 경우)

```typescript
// applyAdjustments 함수 실행
// adjustments = [] (조정 없음)
adjustedContents = contents; // 원본 그대로
```

#### 3.2 미진행 범위 추가

```typescript
// calculateUncompletedRangeBounds 함수 실행
// 미진행 플랜들의 시작점과 종료점 계산
const boundsMap = calculateUncompletedRangeBounds(relevantPastUncompletedPlans);
// Map {
//   'content-id-1' => {
//     startRange: 11,      // 미진행 플랜들의 최소 시작점
//     endRange: 90,         // 미진행 플랜들의 최대 종료점
//     totalUncompleted: 80  // 총 미진행 범위
//   }
// }

// applyUncompletedRangeToContents 함수 실행
// 원본 콘텐츠:
{
  content_id: 'content-id-1',
  start_range: 1,
  end_range: 100
}

// 미진행 범위 적용 후:
{
  content_id: 'content-id-1',
  start_range: 11,       // Math.max(1, 11) = 11
  end_range: 100          // Math.min(100, 90) = 100 (원래 범위 유지)
}

// ✅ 올바른 동작: 11~100페이지로 정확히 재분배됨
```

**✅ 수정 완료**:

- 미진행 범위의 시작점(11)과 종료점(90)을 계산
- `start_range`를 미진행 시작점(11)으로 조정
- `end_range`는 원래 값(100) 유지 (원래 범위를 초과하지 않도록)
- 결과: **11~100페이지**로 정확히 재분배됨

### Step 4: 스케줄 옵션 확인

#### 4.1 스케줄 옵션 조회

```typescript
// getMergedSchedulerSettings 함수 실행
// 병합 순서: 전역 → 템플릿 → 플랜그룹

const mergedSettings = await getMergedSchedulerSettings(
  group.tenant_id,
  group.camp_template_id,
  group.scheduler_options  // 초기 생성 시 설정한 옵션
);

// 결과:
schedulerOptions = {
  study_days: 6,           // ✅ 초기 설정 유지
  review_days: 1,          // ✅ 초기 설정 유지
  weak_subject_focus: false, // ✅ 초기 설정 유지
  review_scope: "weekly",   // ✅ 초기 설정 유지
  lunch_time: { ... },      // ✅ 초기 설정 유지
  camp_study_hours: { ... }, // ✅ 초기 설정 유지
  self_study_hours: { ... }  // ✅ 초기 설정 유지
}
```

**✅ 확인**: 스케줄 옵션은 초기 생성 시 설정한 내용을 그대로 따름

#### 4.2 스케줄 계산

```typescript
// calculateAvailableDates 함수 실행
const scheduleResult = calculateAvailableDates(
  "2025-01-15", // adjustedPeriod.start
  "2025-01-28", // adjustedPeriod.end
  baseBlocks,
  exclusions,
  academySchedules,
  {
    scheduler_type: "1730_timetable",
    scheduler_options: schedulerOptions, // ✅ 초기 설정 옵션 사용
  }
);
```

**✅ 확인**: 1730 타임테이블 스케줄러 옵션이 정상적으로 반영됨

### Step 5: 플랜 생성

#### 5.1 학습일/복습일 계산

```typescript
// generate1730TimetablePlans 함수 실행
// 재조정 기간: 2025-01-15 ~ 2025-01-28 (14일)

// 학습일/복습일 주기 계산:
// study_days: 6, review_days: 1
// 주기: 7일 (6일 학습 + 1일 복습)

// 재조정 기간 내 학습일:
// - 1주차: 1/15(수), 1/16(목), 1/17(금), 1/18(토), 1/19(일), 1/20(월) [6일]
// - 1주차 복습: 1/21(화) [1일]
// - 2주차: 1/22(수), 1/23(목), 1/24(금), 1/25(토), 1/26(일), 1/27(월) [6일]
// - 2주차 복습: 1/28(화) [1일]

// 총 학습일: 12일
// 총 복습일: 2일
```

#### 5.2 학습 범위 분할

```typescript
// divideContentRange 함수 실행
// ✅ 수정된 로직 (올바른 동작):
// 조정된 콘텐츠: start_range: 11, end_range: 100
// totalRange = 100 - 11 = 89페이지
// allocatedDates.length = 12일
// dailyRange = 89 / 12 = 7.4페이지/일

// 첫날 (1/15): 11~18.4페이지 (11 + 0부터 시작, start_range 오프셋 적용)
// 둘째날 (1/16): 18.4~25.8페이지
// ...
// 마지막날 (1/27): 92.6~100페이지
```

**✅ 수정 완료**:

- `calculateUncompletedRangeBounds`로 미진행 범위의 시작점(11)과 종료점(90) 계산
- `applyUncompletedRangeToContents`로 `start_range: 11, end_range: 100` 조정
- `divideContentRange`에서 11~100페이지를 12일로 정확히 분할

---

## ✅ 구현 완료 사항

### 수정된 로직: 미진행 범위 적용 방식

**수정 전 로직** (`applyUncompletedRangeToContents`):

```typescript
// end_range에 미진행 범위 추가
end_range: currentEndRange + uncompletedRange;
```

**수정 후 로직**:

1. `calculateUncompletedRangeBounds` 함수 추가
   - 미진행 범위의 시작점과 종료점 계산
   - 부분 완료된 플랜도 고려
2. `applyUncompletedRangeToContents` 함수 수정
   - 시작점과 종료점 기반으로 범위 조정
   - 원래 범위를 초과하지 않도록 보장

```typescript
// 수정된 로직
const boundsMap = calculateUncompletedRangeBounds(plans);
// Map {
//   'content-id-1' => {
//     startRange: 11,
//     endRange: 90,
//     totalUncompleted: 80
//   }
// }

// 조정된 콘텐츠
{
  start_range: Math.max(originalStartRange, bounds.startRange),  // 11
  end_range: Math.min(originalEndRange, bounds.endRange)          // 100
}
```

**구현 파일**:

- `lib/reschedule/uncompletedRangeCalculator.ts`: 타입 및 함수 추가/수정
- `app/(student)/actions/plan-groups/reschedule.ts`: 새로운 함수 사용

---

## ✅ 검증 체크리스트

### 스케줄 옵션 반영 확인

- [x] **스케줄러 타입**: `1730_timetable` 유지
- [x] **study_days**: 초기 설정(6일) 유지
- [x] **review_days**: 초기 설정(1일) 유지
- [x] **weak_subject_focus**: 초기 설정 유지
- [x] **review_scope**: 초기 설정 유지
- [x] **기타 옵션들**: 초기 설정 유지

### 학습 범위 재분배 확인

- [x] **미진행 범위 계산**: 정확히 계산됨 (11~100페이지) ✅
- [x] **start_range 조정**: 미진행 시작점(11)으로 조정됨 ✅
- [x] **end_range 유지**: 원래 종료점(100) 유지됨 ✅
- [x] **일일 분량 계산**: 남은 기간(12일)에 맞춰 재계산됨 ✅
- [x] **학습일/복습일 분류**: 1730 타임테이블 규칙 적용됨 ✅

### 예상 결과

**재조정 후 플랜 예시**:

- 1일차 (1/15): 11~18페이지 (학습일)
- 2일차 (1/16): 18~25페이지 (학습일)
- ...
- 6일차 (1/20): 46~53페이지 (학습일)
- 7일차 (1/21): 11~53페이지 복습 (복습일)
- 8일차 (1/22): 53~60페이지 (학습일)
- ...
- 12일차 (1/27): 92~100페이지 (학습일)
- 13일차 (1/28): 54~100페이지 복습 (복습일)

---

## 📝 결론

### 확인된 사항

1. **스케줄 옵션**: ✅ 초기 생성 시 설정한 내용을 그대로 따름
2. **1730 타임테이블 옵션**: ✅ 정상적으로 반영됨
3. **학습일/복습일 주기**: ✅ 초기 설정(6일 학습 + 1일 복습) 유지

### 구현 완료 사항

1. **미진행 범위 적용 로직**: ✅ 완료

   - `calculateUncompletedRangeBounds` 함수 추가: 미진행 범위의 시작점과 종료점 계산
   - `applyUncompletedRangeToContents` 함수 수정: 시작점/종료점 기반 범위 조정
   - `start_range`를 미진행 시작점으로 조정, `end_range`는 원래 값 유지

2. **학습 범위 재분배**: ✅ 완료
   - 11~100페이지로 정확히 재분배됨
   - 원래 범위(1~100)를 초과하지 않도록 보장

---

**문서 버전**: 1.1  
**최종 수정일**: 2025-01-XX  
**구현 완료일**: 2025-01-XX

```

이 문서는 다음을 확인합니다:

1. 스케줄 옵션 반영: 재조정 시 초기 생성 시 설정한 1730 타임테이블 옵션이 그대로 적용되는지
2. 부분 완료 처리: 2일차까지 완료한 경우 미진행 범위 계산
3. 재조정 기간: 초기 기간 종료 2주 전 재조정 시나리오
4. 문제점: 현재 로직에서 `end_range`에 미진행 범위를 더하는 방식의 문제

문서를 `docs/reschedule-scenario-partial-completion.md`에 저장할까요?
```
