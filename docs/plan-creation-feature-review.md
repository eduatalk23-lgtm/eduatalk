# 플랜 생성 기능 점검 보고서

## 📋 점검 개요

플랜 생성 시 시간 배분, 학습일/복습일 표시, 주차 그룹화 기능에 대한 종합 점검 결과입니다.

**점검 일시**: 2025-01-XX  
**점검 범위**: 
- 시간 배분 로직
- 학습일/복습일 표시 기능
- 주차 그룹화 기능

---

## ✅ 현재 구현 상태

### 1. 시간 배분 기능

#### 구현 위치
- **핵심 로직**: `lib/plan/scheduler.ts`
- **스케줄 계산**: `lib/scheduler/calculateAvailableDates.ts`
- **UI 표시**: `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx`

#### 동작 방식

**1730 Timetable 스케줄러**:
```typescript
// lib/plan/scheduler.ts:391-393
const studyDays = options?.study_days ?? 6;
const reviewDays = options?.review_days ?? 1;
const weekSize = studyDays + reviewDays;
```

1. **학습일 시간 배분**:
   - 각 콘텐츠의 학습 범위를 전체 학습일로 나누어 배정
   - 주차별로 학습일 수만큼 콘텐츠를 분배
   - 블록 기반 시간 배분 (Step 2.5의 `dateAvailableTimeRanges` 사용)

2. **복습일 시간 배분**:
   - 해당 주차의 학습 범위를 복습
   - 학습일에 배정된 콘텐츠 범위를 저장하여 복습일에 재사용

3. **블록 동적 생성**:
   - Step 2.5 스케줄 결과의 `available_time_ranges`를 사용
   - 각 플랜에 대해 동적으로 블록 인덱스 할당

#### ✅ 정상 동작 확인
- 시간 배분 로직이 정상적으로 작동함
- 블록 기반 시간 할당이 올바르게 수행됨
- Step 2.5의 시간 범위 정보가 정확히 반영됨

---

### 2. 학습일/복습일 표시 기능

#### 구현 위치
- **스케줄 미리보기**: `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx`
- **플랜 결과 표시**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

#### 현재 상태

**✅ Step 2.5 (스케줄 미리보기)**:
- 학습일/복습일이 명확히 표시됨
- 색상 구분 (학습일: 파란색, 복습일: 초록색)
- 주차별 학습일/복습일 통계 표시

```typescript
// Step2_5SchedulePreview.tsx:19-33
const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  // ...
};

const dayTypeColors: Record<string, string> = {
  학습일: "bg-blue-100 text-blue-800 border-blue-200",
  복습일: "bg-green-100 text-green-800 border-green-200",
  // ...
};
```

**❌ Step 7 (플랜 결과 표시)**:
- 학습일/복습일 정보가 표시되지 않음
- `ScheduleTableRow` 타입에 `dayType` 필드가 없음
- `transformPlansToScheduleTable` 함수에서 학습일/복습일 정보를 전달하지 않음

#### 문제점
1. 플랜 생성 결과에서 학습일/복습일 구분이 불가능
2. 사용자가 어떤 날이 학습일이고 복습일인지 확인할 수 없음
3. 주차 그룹화는 되지만 학습일/복습일 정보가 누락됨

---

### 3. 주차 그룹화 기능

#### 구현 위치
- **주차 계산**: `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`
- **UI 표시**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

#### 현재 상태

**✅ 주차 계산 로직**:
```typescript
// scheduleTransform.ts:53-76
function calculateWeekNumber(
  planDate: string,
  periodStart: string
): { week: number; day: number } {
  const start = new Date(periodStart);
  const current = new Date(planDate);
  
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const week = Math.floor(diffDays / 7) + 1;
  const day = (diffDays % 7) + 1;
  
  return { week, day };
}
```

**✅ UI 표시**:
- "1주차-1일" 형식으로 표시됨
- 날짜 순으로 정렬되어 주차별 그룹화가 자연스럽게 이루어짐

**⚠️ 개선 필요 사항**:
- 주차별로 시각적 그룹화가 없음 (테이블 헤더로 주차 구분)
- 학습일/복습일 정보가 주차 표시에 포함되지 않음

---

## 🔍 발견된 문제점

### 1. 학습일/복습일 정보 누락 (중요)

**위치**: `Step7ScheduleResult/ScheduleTableView.tsx`

**문제**:
- 플랜 생성 결과에서 학습일/복습일 구분이 불가능
- `ScheduleTableRow` 타입에 `dayType` 필드가 없음
- `transformPlansToScheduleTable` 함수에서 학습일/복습일 정보를 전달하지 않음

**영향**:
- 사용자가 플랜 결과를 확인할 때 학습일/복습일을 구분할 수 없음
- 1730 Timetable 스케줄러의 핵심 기능인 학습일/복습일 구분이 결과 화면에서 사라짐

### 2. 주차 그룹화 시각화 부족

**위치**: `Step7ScheduleResult/ScheduleTableView.tsx`

**문제**:
- 주차별로 시각적 그룹화가 없음
- 단순히 "1주차-1일" 텍스트로만 표시됨
- 주차 헤더나 구분선이 없어 가독성이 떨어짐

**영향**:
- 많은 플랜이 있을 때 주차별 구분이 어려움
- 주차별 통계나 요약 정보를 확인하기 어려움

### 3. 시간 배분 정보 부족

**위치**: `Step7ScheduleResult/ScheduleTableView.tsx`

**문제**:
- 시간 정보가 "HH:MM" 형식으로만 표시됨
- 블록 기반 시간 배분 정보가 상세히 표시되지 않음
- 예상 소요시간은 표시되지만 실제 시간 범위 정보가 부족

---

## 💡 개선 제안

### 1. 학습일/복습일 정보 추가 (우선순위: 높음)

#### 수정 파일
1. `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`
2. `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
3. `app/(student)/actions/planGroupActions.ts` (데이터 조회 부분)

#### 구현 내용
1. `ScheduleTableRow` 타입에 `dayType` 필드 추가
2. `transformPlansToScheduleTable` 함수에서 학습일/복습일 정보 계산 및 전달
3. `ScheduleTableView`에서 학습일/복습일 배지 표시

#### 예상 코드 변경
```typescript
// scheduleTransform.ts
export type ScheduleTableRow = {
  // ... 기존 필드
  dayType: "학습일" | "복습일" | null; // 추가
};

// transformPlansToScheduleTable 함수에서
// plan_group의 scheduler_type과 scheduler_options를 사용하여
// 각 날짜가 학습일인지 복습일인지 계산
```

### 2. 주차별 그룹화 UI 개선 (우선순위: 중간)

#### 구현 내용
1. 주차별 헤더 추가
2. 주차별 통계 정보 표시 (학습일 수, 복습일 수, 총 시간)
3. 주차별 접기/펼치기 기능

#### 참고 구현
- `Step2_5SchedulePreview.tsx`의 `WeekSection` 컴포넌트 참고

### 3. 시간 배분 정보 상세화 (우선순위: 낮음)

#### 구현 내용
1. 시간 범위 표시 (예: "10:00-12:00")
2. 블록 인덱스 정보 표시
3. 시간 배분 비율 표시 (선택사항)

---

## 📊 점검 결과 요약

| 기능 | 상태 | 우선순위 | 비고 |
|------|------|---------|------|
| 시간 배분 로직 | ✅ 정상 | - | 블록 기반 시간 배분 정상 작동 |
| 학습일/복습일 계산 | ✅ 정상 | - | 스케줄러 로직에서 정상 계산 |
| 학습일/복습일 표시 (Step 2.5) | ✅ 정상 | - | 미리보기에서 정상 표시 |
| 학습일/복습일 표시 (Step 7) | ❌ 누락 | 높음 | 결과 화면에서 표시되지 않음 |
| 주차 계산 | ✅ 정상 | - | 주차 계산 로직 정상 |
| 주차 그룹화 UI | ⚠️ 개선 필요 | 중간 | 시각적 그룹화 부족 |
| 시간 정보 표시 | ⚠️ 개선 필요 | 낮음 | 상세 정보 부족 |

---

## 🎯 권장 조치 사항

### 즉시 조치 (우선순위: 높음)
1. **학습일/복습일 정보 추가**
   - `ScheduleTableRow` 타입에 `dayType` 필드 추가
   - `transformPlansToScheduleTable` 함수 수정
   - `ScheduleTableView`에 배지 표시 추가

### 단기 개선 (우선순위: 중간)
2. **주차별 그룹화 UI 개선**
   - 주차 헤더 추가
   - 주차별 통계 정보 표시
   - 접기/펼치기 기능

### 장기 개선 (우선순위: 낮음)
3. **시간 배분 정보 상세화**
   - 시간 범위 상세 표시
   - 블록 정보 표시

---

## 📝 참고 파일

### 핵심 파일
- `lib/plan/scheduler.ts` - 플랜 생성 로직
- `lib/scheduler/calculateAvailableDates.ts` - 스케줄 계산
- `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts` - 데이터 변환
- `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx` - 결과 표시 UI
- `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx` - 미리보기 UI (참고)

### 관련 타입
- `lib/types/plan.ts` - 플랜 관련 타입 정의
- `lib/scheduler/calculateAvailableDates.ts` - 스케줄 관련 타입 정의

---

## ✅ 결론

플랜 생성 기능의 핵심 로직은 정상적으로 작동하고 있습니다. 

### 개선 완료 사항
1. **학습일/복습일 표시 기능 추가** ✅
   - `ScheduleTableRow` 타입에 `dayType` 필드 추가
   - `transformPlansToScheduleTable` 함수에서 학습일/복습일 계산 로직 추가
   - `ScheduleTableView`에서 학습일/복습일 배지 표시 추가
   - 1730 Timetable 스케줄러에서 학습일/복습일 구분이 명확히 표시됨

### 향후 개선 사항
- 주차별 시각적 그룹화 (헤더 추가, 접기/펼치기)
- 제외일 정보를 고려한 학습일/복습일 계산 (현재는 제외일을 고려하지 않음)
- 시간 배분 정보 상세화

