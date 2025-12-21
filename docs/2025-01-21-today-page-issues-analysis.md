# 학습 관리(/today) 페이지 문제 분석

**작성일**: 2025-01-21  
**분석 대상**: `/today` 페이지와 `/plan/calendar` 페이지 비교

---

## 🔍 문제 요약

### 문제 1: 날짜별 플랜 표시 문제 ✅ 해결됨
- **현상**: 캘린더에서는 날짜별 생성되어 있는 플랜이 잘 보이지만, 학습 관리(/today)에서는 1개만 보임
- **원인**: `groupPlansByPlanNumber` 함수가 같은 `plan_number`를 가진 모든 플랜을 하나로 그룹화하여, 분할되지 않은 플랜도 일부만 표시됨
- **해결**: 조건부 그룹화 로직 적용 - `is_partial === true` 또는 `is_continued === true`인 플랜만 그룹화하고, 나머지는 개별 표시
- **영향**: 같은 날짜의 모든 플랜이 올바르게 표시됨

### 문제 2: 학습 성취도 요약 기능 개선 필요
- **현상**: 다른 날짜에 대한 부분이 고려되지 않음
- **영향**: 주간/월간 통계 등 기간별 성취도를 확인할 수 없음

---

## 📊 현재 구현 분석

### 1. `/today` 페이지 데이터 페칭 방식

**파일**: `app/(student)/today/page.tsx`

```typescript
// 단일 날짜만 조회
await queryClient.prefetchQuery(
  todayPlansQueryOptions(
    userId,
    tenantContext?.tenantId || null,
    targetProgressDate, // 단일 날짜만 전달
    {
      camp: false,
      includeProgress: false,
    }
  )
);
```

**파일**: `lib/data/todayPlans.ts` (line 414-421)

```typescript
// 선택한 날짜 플랜 조회 (View 사용으로 최적화)
let plans = await getPlansFromView({
  studentId,
  tenantId,
  planDate: targetDate, // 단일 날짜만 조회
  planGroupIds: planGroupIds.length > 0 ? planGroupIds : undefined,
});
```

**특징**:
- `planDate` 파라미터로 **단일 날짜**만 조회
- 날짜 범위(`dateRange`) 조회 기능은 있으나 사용하지 않음
- `PlanViewContainer`에서 날짜 네비게이션으로 다른 날짜 조회 가능하지만, 한 번에 하나의 날짜만 표시

### 2. `/plan/calendar` 페이지 데이터 페칭 방식

**파일**: `app/(student)/plan/calendar/page.tsx` (line 138-145)

```typescript
// 활성 플랜 그룹에 속한 플랜만 조회 (데이터베이스 레벨 필터링)
const filteredPlans = await getPlansForStudent({
  studentId: user.id,
  dateRange: {
    start: minDateStr, // 날짜 범위 시작
    end: maxDateStr,    // 날짜 범위 종료
  },
  planGroupIds: activeGroupIds,
});
```

**특징**:
- `dateRange` 파라미터로 **날짜 범위** 전체 조회
- `useCalendarData` 훅으로 날짜별 그룹화 (line 33-43)
- 여러 날짜의 플랜을 한 번에 표시 가능

### 3. 플랜 표시 방식 비교

#### `/today` 페이지
- **컴포넌트**: `DailyPlanListView`, `SinglePlanView`
- **데이터**: `groups` (planNumber별 그룹화된 플랜)
- **표시**: 선택한 날짜(`planDate`)의 플랜만 표시
- **네비게이션**: 날짜 이동 버튼으로 다른 날짜 조회 가능

#### `/plan/calendar` 페이지
- **컴포넌트**: `MonthView`, `WeekView`, `DayView`
- **데이터**: `plansByDate` (날짜별 그룹화된 플랜 맵)
- **표시**: 여러 날짜의 플랜을 캘린더 형식으로 표시
- **네비게이션**: 월/주/일 뷰 전환 가능

### 4. 학습 성취도 계산 방식

**파일**: `lib/data/todayPlans.ts` (line 479-715)

```typescript
// Calculate todayProgress from already loaded data
let todayProgress: TodayProgress | null = null;
if (includeProgress) {
  try {
    // Use already loaded plans (no need to re-query)
    const planTotalCount = plans.length; // 단일 날짜의 플랜만
    const planCompletedCount = plans.filter(
      (plan) => !!plan.actual_end_time
    ).length; // 단일 날짜의 완료 플랜만

    // todayStudyMinutes 계산도 단일 날짜의 세션만 사용
    const todayStudySeconds = plans.reduce((total, plan) => {
      return (
        total +
        calculatePlanStudySeconds(
          {
            actual_start_time: plan.actual_start_time,
            actual_end_time: plan.actual_end_time,
            // ...
          },
          nowMs,
          plan.actual_end_time ? undefined : activeSessionMap.get(plan.id)
        )
      );
    }, 0);
  }
}
```

**특징**:
- `targetDate`에 해당하는 플랜만 사용하여 진행률 계산
- 다른 날짜의 데이터는 고려하지 않음
- 주간/월간 통계 기능 없음

---

## 🎯 문제 원인 분석

### 문제 1 원인 ✅ 해결됨

**핵심 원인**: `groupPlansByPlanNumber` 함수의 그룹화 로직 문제
- 같은 `plan_number`를 가진 모든 플랜을 하나로 그룹화
- 분할되지 않은 플랜(`is_partial === false`, `is_continued === false`)도 그룹화되어 일부만 표시됨
- 원래 목적: 비학습 시간으로 인해 여러 시간 블록에 걸쳐 쪼개진 플랜만 그룹화해야 함

**해결 방법**:
- 조건부 그룹화 로직 적용
- `is_partial === true` 또는 `is_continued === true`인 플랜만 `plan_number`로 그룹화
- 그 외의 플랜은 모두 개별적으로 표시

**수정 파일**: `app/(student)/today/_utils/planGroupUtils.ts`
- `groupPlansByPlanNumber` 함수를 조건부 그룹화로 수정
- 분할된 플랜과 분할되지 않은 플랜을 분리하여 처리
- 결과 병합 및 정렬 로직 추가

### 문제 2 원인

1. **성취도 계산 범위 제한**
   - `getTodayPlans` 함수가 단일 날짜의 데이터만 사용
   - 주간/월간 통계를 위한 별도 로직 없음

2. **UI 컴포넌트 제한**
   - `TodayAchievements` 컴포넌트가 단일 날짜의 `todayProgress`만 표시
   - 기간별 통계 표시 기능 없음

---

## 📋 개선 방향 제안

### 개선 방향 1: 날짜별 플랜 표시 개선

**옵션 A: 주간 뷰 추가**
- `/today` 페이지에 "주간 뷰" 모드 추가
- 현재 날짜 기준 ±3일 범위의 플랜을 한 번에 표시
- 날짜별 섹션으로 구분하여 표시

**옵션 B: 날짜 범위 조회 기능 활용**
- `getTodayPlans` 함수의 `dateRange` 옵션 활용
- 주간/월간 데이터를 한 번에 조회하여 표시

**옵션 C: 캘린더 뷰 통합**
- `/today` 페이지에 캘린더 뷰 옵션 추가
- `/plan/calendar`의 컴포넌트 재사용

### 개선 방향 2: 학습 성취도 요약 개선

**옵션 A: 기간별 통계 추가**
- 주간/월간 성취도 계산 함수 추가
- `TodayAchievements` 컴포넌트에 기간 선택 기능 추가

**옵션 B: 비교 통계 추가**
- 오늘 vs 어제, 이번 주 vs 지난 주 비교 기능
- 트렌드 차트 추가

**옵션 C: 통합 대시보드**
- 단일 날짜 + 주간 + 월간 통계를 모두 표시
- 탭 또는 섹션으로 구분

---

## 🔧 기술적 고려사항

### 데이터 페칭 최적화
- 날짜 범위 조회 시 성능 영향 고려
- 캐싱 전략 재검토 필요
- React Query 쿼리 키 구조 변경 필요

### 컴포넌트 구조
- 기존 컴포넌트 재사용 vs 새 컴포넌트 생성
- 상태 관리 복잡도 증가 고려

### 사용자 경험
- 로딩 상태 처리
- 빈 상태 처리
- 날짜 네비게이션 UX 개선

---

## 📝 다음 단계

1. **사용자 요구사항 명확화**
   - 여러 날짜 플랜 표시 방식 결정 (주간 뷰? 캘린더 뷰?)
   - 성취도 요약 범위 결정 (주간? 월간? 비교?)

2. **기술 설계**
   - 데이터 페칭 로직 수정 계획
   - 컴포넌트 구조 설계
   - 성능 최적화 방안

3. **구현 계획**
   - 단계별 구현 우선순위
   - 테스트 계획

---

## ✅ 해결 완료 사항

### 문제 1 해결: 조건부 그룹화 로직 적용 (2025-01-21)

**수정 내용**:
- `groupPlansByPlanNumber` 함수를 조건부 그룹화로 변경
- 분할된 플랜(`is_partial === true` 또는 `is_continued === true`)만 그룹화
- 분할되지 않은 플랜은 모두 개별적으로 표시

**수정 파일**:
- `app/(student)/today/_utils/planGroupUtils.ts` - 그룹화 로직 수정

**결과**:
- 같은 날짜의 모든 플랜이 올바르게 표시됨
- 분할된 플랜은 그룹화되어 표시되고, 나머지는 개별 표시
- 기존 컴포넌트와 호환성 유지

---

## 📚 참고 파일

- `app/(student)/today/page.tsx` - Today 페이지 메인
- `app/(student)/today/_components/PlanViewContainer.tsx` - 플랜 뷰 컨테이너
- `app/(student)/today/_components/TodayAchievements.tsx` - 성취도 표시 컴포넌트
- `app/(student)/today/_utils/planGroupUtils.ts` - 플랜 그룹화 유틸리티 (수정됨)
- `lib/data/todayPlans.ts` - Today 플랜 데이터 페칭 로직
- `app/(student)/plan/calendar/page.tsx` - 캘린더 페이지 (참고)
- `app/(student)/plan/calendar/_hooks/useCalendarData.ts` - 날짜별 그룹화 로직 (참고)

