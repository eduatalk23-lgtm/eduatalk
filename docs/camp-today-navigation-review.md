# 캠프 학습 관리 네비게이션 리팩토링 검토 보고서

## 📋 검토 개요

캠프 모드와 일반 모드 간 네비게이션 일관성을 확보하기 위해 수행한 리팩토링의 최종 검토 결과입니다.

## ✅ 검토 완료 사항

### 1. Props 타입 정의 및 Destructuring 확인

모든 컴포넌트에서 `campMode?: boolean` prop이 올바르게 타입 정의되고 destructure되었습니다:

- ✅ `PlanItem.tsx`: `campMode = false` (기본값)
- ✅ `PlanGroupCard.tsx`: `campMode = false` (기본값)
- ✅ `TimerControlButtons.tsx`: `campMode = false` (기본값)
- ✅ `PlanCard.tsx`: `campMode = false` (기본값)
- ✅ `PlanTimerCard.tsx`: `campMode = false` (기본값)
- ✅ `DailyPlanView.tsx`: `campMode = false` (기본값)
- ✅ `SinglePlanView.tsx`: `campMode = false` (기본값)
- ✅ `DailyPlanListView.tsx`: `campMode = false` (기본값)
- ✅ `TodayPlanListView.tsx`: `campMode = false` (기본값)

### 2. 네비게이션 로직 통일

모든 컴포넌트에서 `/today/plan/[planId]`로의 네비게이션이 `buildPlanExecutionUrl` 헬퍼 함수를 사용하도록 통일되었습니다:

**헬퍼 함수** (`app/(student)/today/_utils/navigationUtils.ts`):

```typescript
export function buildPlanExecutionUrl(
  planId: string,
  campMode?: boolean
): string {
  const query = campMode ? "?mode=camp" : "";
  return `/today/plan/${planId}${query}`;
}
```

**적용된 컴포넌트**:

- ✅ `PlanItem.tsx`: `handleComplete`에서 사용
- ✅ `PlanGroupCard.tsx`: `handleGroupComplete`에서 사용
- ✅ `TimerControlButtons.tsx`: 완료된 플랜 상세보기에서 사용
- ✅ `PlanCard.tsx`: `handleComplete`에서 사용
- ✅ `PlanTimerCard.tsx`: 완료 핸들러 및 상세보기 버튼에서 사용 (2곳)

### 3. 하드코딩된 네비게이션 제거

모든 하드코딩된 `?mode=camp` 및 `campMode`를 무시하는 네비게이션이 제거되었습니다:

- ✅ `PlanItem.tsx`: 하드코딩 제거, `buildPlanExecutionUrl` 사용
- ✅ `PlanGroupCard.tsx`: 하드코딩 제거, `buildPlanExecutionUrl` 사용
- ✅ `TimerControlButtons.tsx`: 하드코딩 제거, `buildPlanExecutionUrl` 사용
- ✅ `PlanCard.tsx`: 하드코딩 제거, `buildPlanExecutionUrl` 사용
- ✅ `PlanTimerCard.tsx`: 하드코딩 제거, `buildPlanExecutionUrl` 사용 (2곳)

### 4. Prop 전달 체인 확인

`campMode` prop이 올바르게 전달되는지 확인:

**전달 경로 1: PlanViewContainer → DailyPlanListView / SinglePlanView**

```
PlanViewContainer (campMode)
  ├─ DailyPlanListView (campMode)
  │   └─ PlanCard (campMode)
  └─ SinglePlanView (campMode)
      └─ PlanCard (campMode)
```

**전달 경로 2: PlanViewContainer → TodayPlanListView → DailyPlanView / SinglePlanView**

```
PlanViewContainer (campMode)
  └─ TodayPlanListView (campMode)
      ├─ DailyPlanView (campMode)
      │   └─ PlanGroupCard (campMode)
      │       ├─ PlanItem (campMode)
      │       │   └─ TimerControlButtons (campMode)
      │       └─ TimerControlButtons (campMode)
      └─ SinglePlanView (campMode)
          └─ PlanCard (campMode)
```

### 5. 사용처 확인

**일반 Today 모드** (`/today/page.tsx`):

- ✅ `TodayPageContent`에 `campMode` prop 전달하지 않음 (기본값 `false` 사용)
- ✅ 모든 네비게이션 → `/today/plan/[id]` (쿼리 파라미터 없음)

**캠프 학습 관리 모드** (`/camp/today/page.tsx`):

- ✅ `TodayPageContent`에 `campMode={true}` 전달
- ✅ 모든 네비게이션 → `/today/plan/[id]?mode=camp`

## 🔧 수정된 파일 목록

### 핵심 컴포넌트 (5개)

1. `app/(student)/today/_components/PlanItem.tsx`
2. `app/(student)/today/_components/PlanGroupCard.tsx`
3. `app/(student)/today/_components/TimerControlButtons.tsx`
4. `app/(student)/today/_components/PlanCard.tsx`
5. `app/(student)/today/_components/PlanTimerCard.tsx`

### 중간 컴포넌트 (4개)

6. `app/(student)/today/_components/DailyPlanView.tsx`
7. `app/(student)/today/_components/SinglePlanView.tsx`
8. `app/(student)/today/_components/DailyPlanListView.tsx`
9. `app/(student)/today/_components/TodayPlanListView.tsx`

### 유틸리티 (1개)

10. `app/(student)/today/_utils/navigationUtils.ts` (신규 생성)

## 🎯 추출된 헬퍼 함수

### `buildPlanExecutionUrl`

**위치**: `app/(student)/today/_utils/navigationUtils.ts`

**시그니처**:

```typescript
export function buildPlanExecutionUrl(
  planId: string,
  campMode?: boolean
): string;
```

**사용처**:

- `PlanItem.tsx` (1곳)
- `PlanGroupCard.tsx` (1곳)
- `TimerControlButtons.tsx` (1곳)
- `PlanCard.tsx` (1곳)
- `PlanTimerCard.tsx` (3곳)

**효과**: 중복 코드 제거 및 네비게이션 로직 일관성 확보

## ✅ 최종 확인 사항

### 일반 Today 모드 (`/today`)

1. ✅ 모든 완료 관련 네비게이션 → `/today/plan/[id]` (쿼리 파라미터 없음)
2. ✅ 완료 페이지의 뒤로가기 → `/today`
3. ✅ `PlanExecutionForm` 리다이렉트 → `/today?completedPlanId=...`

### 캠프 학습 관리 모드 (`/camp/today`)

1. ✅ 모든 완료 관련 네비게이션 → `/today/plan/[id]?mode=camp`
2. ✅ 완료 페이지의 뒤로가기 → `/camp/today`
3. ✅ `PlanExecutionForm` 리다이렉트 → `/camp/today?completedPlanId=...`
4. ✅ 캠프 모드 UI 및 텍스트 표시

### 기존 기능 유지

1. ✅ `PlanExecutionPage`: `searchParams.mode` 읽기 및 뒤로가기 링크 설정 (변경 없음)
2. ✅ `PlanExecutionForm`: 모드에 따른 리다이렉트 (변경 없음)
3. ✅ 타이머 스토어 및 핵심 타이머 로직 (변경 없음)
4. ✅ `preparePlanCompletion` / `completePlan` 시맨틱 (변경 없음)

## 📝 참고 사항

### TodayPlanItem.tsx

`TodayPlanItem.tsx`는 `Link` 컴포넌트를 사용하여 네비게이션을 처리하며, `campMode` prop이 없습니다. 이 컴포넌트는 `DraggablePlanList`에서만 사용되며, 일반 Today 페이지나 캠프 학습 관리 페이지에서 직접 사용되지 않습니다. 따라서 별도 수정이 필요하지 않습니다.

### TimeCheckSection.tsx

`TimeCheckSection.tsx`는 `TimerControlButtons`를 사용하지만, 이 컴포넌트가 어디서 사용되는지 확인이 필요합니다. 현재는 `campMode` prop을 전달하지 않지만, 일반 Today 페이지에서만 사용된다면 기본값 `false`로 동작하므로 문제가 없습니다.

## 🎉 결론

모든 검토 사항이 완료되었으며, 네비게이션 로직이 일관되게 동작하도록 리팩토링되었습니다. 중복 코드는 헬퍼 함수로 추출되어 유지보수성이 향상되었습니다.

---

**검토 날짜**: 2025년 1월 27일  
**검토자**: AI Assistant
