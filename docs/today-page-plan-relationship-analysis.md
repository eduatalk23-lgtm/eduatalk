# Today 페이지와 플랜그룹/플랜 캘린더 관계 분석

## 📋 분석 개요

`/app/(student)/today` 경로의 기능들이 플랜그룹, 플랜 캘린더 등에서 생성한 플랜 정보를 바탕으로 동작하는지 분석한 결과입니다.

## ✅ 결론

**네, Today 페이지는 플랜그룹과 플랜 캘린더에서 생성한 플랜 정보를 바탕으로 동작합니다.**

## 🔍 상세 분석

### 1. Today 페이지의 플랜 조회 방식

Today 페이지는 `getPlansForStudent` 함수를 통해 오늘 날짜의 플랜을 조회합니다:

```60:64:app/(student)/today/_components/TodayPlanList.tsx
      getPlansForStudent({
        studentId: user.userId,
        tenantId: tenantContext?.tenantId || null,
        planDate: todayDate,
      }),
```

### 2. 플랜 데이터 구조

`student_plan` 테이블의 플랜 타입에는 `plan_group_id` 필드가 포함되어 있습니다:

```19:19:lib/data/studentPlans.ts
  plan_group_id?: string | null;
```

이 필드를 통해 플랜이 어떤 플랜그룹에서 생성되었는지 추적할 수 있습니다.

### 3. 플랜 조회 함수의 플랜그룹 필터링 지원

`getPlansForStudent` 함수는 `planGroupIds` 파라미터를 통해 특정 플랜그룹의 플랜만 필터링할 수 있습니다:

```110:129:lib/data/studentPlans.ts
  if (filters.planGroupIds && filters.planGroupIds.length > 0) {
    // plan_group_id가 NULL이 아닌 값만 필터링
    // .in() 메서드는 배열의 값들 중 하나와 일치하는 행을 반환
    try {
      // planGroupIds가 유효한 UUID 배열인지 확인
      const validGroupIds = filters.planGroupIds.filter(
        (id) => id && typeof id === "string" && id.trim().length > 0
      );
      
      if (validGroupIds.length > 0) {
        query = query.in("plan_group_id", validGroupIds);
      } else {
        console.warn("[data/studentPlans] 유효한 planGroupIds가 없습니다:", filters.planGroupIds);
        return []; // 유효한 ID가 없으면 빈 배열 반환
      }
    } catch (filterError) {
      console.error("[data/studentPlans] planGroupIds 필터링 중 오류:", filterError);
      // 필터링 실패 시 전체 조회로 폴백
    }
  }
```

### 4. Today 페이지의 플랜 표시

Today 페이지는 다음과 같은 플랜 정보를 표시합니다:

- **플랜 목록** (`TodayPlanList`): 오늘 날짜의 모든 플랜을 표시
- **현재 학습 중인 플랜** (`CurrentLearningSection`): 활성화된 학습 세션이 있는 플랜
- **플랜 상세 페이지** (`/today/plan/[planId]`): 개별 플랜의 실행 페이지

### 5. 플랜 생성 경로

플랜은 다음과 같은 경로로 생성될 수 있습니다:

1. **플랜그룹 스케줄러**: 플랜그룹의 설정과 콘텐츠를 바탕으로 플랜 생성
2. **플랜 캘린더**: 캘린더에서 직접 플랜 생성
3. **자동 스케줄러**: `autoSchedule` 액션을 통한 자동 생성

생성된 모든 플랜은 `student_plan` 테이블에 저장되며, 플랜그룹에서 생성된 경우 `plan_group_id` 필드에 해당 그룹의 ID가 저장됩니다.

### 6. Today 페이지의 기능들

#### 6.1 TodayPlanList
- 오늘 날짜의 모든 플랜을 조회하여 표시
- 플랜의 진행률, 상태, 콘텐츠 정보를 표시
- 드래그 앤 드롭으로 플랜 순서 변경 가능

#### 6.2 CurrentLearningSection
- 현재 활성화된 학습 세션이 있는 플랜을 표시
- 학습 타이머 및 진행 상황 표시

#### 6.3 TodayPlanItem
- 개별 플랜 아이템 표시
- 플랜 상태 (예정, 진행 중, 완료) 표시
- 플랜 상세 페이지로 이동 가능

#### 6.4 PlanExecutionForm
- 플랜 실행 폼
- 학습 시작/일시정지/완료 기능
- 진행률 기록 기능

### 7. 플랜 액션들

Today 페이지에서 사용하는 주요 액션들:

- `startPlan`: 플랜 시작 (타이머 시작)
- `completePlan`: 플랜 완료 (기록 저장)
- `postponePlan`: 플랜 미루기 (내일로 이동)
- `pausePlan`: 플랜 일시정지
- `resumePlan`: 플랜 재개

이러한 액션들은 모두 `student_plan` 테이블의 플랜을 대상으로 동작하며, 플랜그룹이나 플랜 캘린더에서 생성된 플랜과 구분 없이 동일하게 작동합니다.

## 📊 데이터 흐름

```
플랜그룹/플랜 캘린더 생성
    ↓
student_plan 테이블에 플랜 저장 (plan_group_id 포함)
    ↓
getPlansForStudent() 함수로 오늘 날짜 플랜 조회
    ↓
TodayPlanList 컴포넌트에서 플랜 목록 표시
    ↓
사용자가 플랜 실행/완료
    ↓
student_plan 테이블 업데이트
```

## 🎯 핵심 포인트

1. **Today 페이지는 플랜의 출처를 구분하지 않습니다**
   - 플랜그룹에서 생성된 플랜
   - 플랜 캘린더에서 생성된 플랜
   - 자동 스케줄러에서 생성된 플랜
   - 모든 플랜을 동일하게 처리합니다

2. **플랜그룹 추적은 가능합니다**
   - `plan_group_id` 필드를 통해 어떤 플랜그룹에서 생성되었는지 확인 가능
   - 현재 Today 페이지에서는 이 정보를 직접 표시하지 않지만, 필요시 활용 가능

3. **플랜 조회는 날짜 기반입니다**
   - `planDate` 파라미터로 특정 날짜의 플랜만 조회
   - Today 페이지는 오늘 날짜(`todayDate`)의 플랜만 조회

## 📝 결론

Today 페이지의 모든 기능은 `student_plan` 테이블에 저장된 플랜 정보를 바탕으로 동작하며, 이 플랜들은 플랜그룹, 플랜 캘린더, 자동 스케줄러 등 다양한 경로로 생성될 수 있습니다. 따라서 **Today 페이지는 플랜그룹과 플랜 캘린더에서 생성한 플랜 정보를 바탕으로 기능합니다.**

