# 캠프 학습 관리 페이지 네비게이션 수정

## 🔍 문제 상황

캠프 학습 관리 페이지(`/camp/today`)에서 플랜 완료 관련 네비게이션이 일반 모드와 캠프 모드를 구분하지 않아 혼란스러웠습니다.

### 문제점

1. **PlanItem 컴포넌트**: 항상 `?mode=camp`를 추가하여 일반 모드에서도 캠프 모드로 이동
2. **PlanGroupCard 컴포넌트**: 항상 `?mode=camp`를 추가하여 일반 모드에서도 캠프 모드로 이동
3. **TimerControlButtons 컴포넌트**: `mode` 파라미터를 추가하지 않아 캠프 모드에서도 일반 모드로 이동
4. **PlanCard 컴포넌트**: `mode` 파라미터를 추가하지 않아 캠프 모드에서도 일반 모드로 이동
5. **PlanTimerCard 컴포넌트**: `mode` 파라미터를 추가하지 않아 캠프 모드에서도 일반 모드로 이동

## 🛠 수정 내용

### 1. PlanItem.tsx

**파일**: `app/(student)/today/_components/PlanItem.tsx`

**변경 사항**:
- `campMode?: boolean` prop 추가
- `handleComplete`에서 조건부로 `?mode=camp` 쿼리 파라미터 추가
- `TimerControlButtons`에 `campMode` 전달

**변경 전**:
```tsx
type PlanItemProps = {
  plan: PlanWithContent;
  isGrouped: boolean;
  showTimer?: boolean;
  viewMode?: "daily" | "single";
};

// handleComplete에서
router.push(`/today/plan/${plan.id}?mode=camp`);
```

**변경 후**:
```tsx
type PlanItemProps = {
  plan: PlanWithContent;
  isGrouped: boolean;
  showTimer?: boolean;
  viewMode?: "daily" | "single";
  campMode?: boolean; // 추가
};

// handleComplete에서
const query = campMode ? "?mode=camp" : "";
router.push(`/today/plan/${plan.id}${query}`);
```

### 2. PlanGroupCard.tsx

**파일**: `app/(student)/today/_components/PlanGroupCard.tsx`

**변경 사항**:
- `campMode?: boolean` prop 추가
- `handleGroupComplete`에서 조건부로 `?mode=camp` 쿼리 파라미터 추가
- `PlanItem`과 `TimerControlButtons`에 `campMode` 전달

**변경 전**:
```tsx
router.push(`/today/plan/${targetPlanId}?mode=camp`);
```

**변경 후**:
```tsx
const query = campMode ? "?mode=camp" : "";
router.push(`/today/plan/${targetPlanId}${query}`);
```

### 3. TimerControlButtons.tsx

**파일**: `app/(student)/today/_components/TimerControlButtons.tsx`

**변경 사항**:
- `campMode?: boolean` prop 추가
- 완료된 플랜 상세보기 버튼에서 조건부로 `?mode=camp` 쿼리 파라미터 추가

**변경 전**:
```tsx
onClick={() => router.push(`/today/plan/${planId}`)}
```

**변경 후**:
```tsx
const navigateToPlan = () => {
  const query = campMode ? "?mode=camp" : "";
  router.push(`/today/plan/${planId}${query}`);
};
```

### 4. PlanCard.tsx

**파일**: `app/(student)/today/_components/PlanCard.tsx`

**변경 사항**:
- `campMode?: boolean` prop 추가
- 완료 핸들러에서 조건부로 `?mode=camp` 쿼리 파라미터 추가

**변경 전**:
```tsx
router.push(`/today/plan/${targetPlanId}`);
```

**변경 후**:
```tsx
const query = campMode ? "?mode=camp" : "";
router.push(`/today/plan/${targetPlanId}${query}`);
```

### 5. PlanTimerCard.tsx

**파일**: `app/(student)/today/_components/PlanTimerCard.tsx`

**변경 사항**:
- `campMode?: boolean` prop 추가
- 완료 핸들러 및 상세보기 버튼에서 조건부로 `?mode=camp` 쿼리 파라미터 추가

**변경 전**:
```tsx
router.push(`/today/plan/${planId}`);
```

**변경 후**:
```tsx
const query = campMode ? "?mode=camp" : "";
router.push(`/today/plan/${planId}${query}`);
```

### 6. Prop 전달 체인 수정

다음 컴포넌트들에 `campMode` prop을 추가하고 하위 컴포넌트로 전달:

- **DailyPlanView.tsx**: `campMode` prop 추가 → `PlanGroupCard`에 전달
- **SinglePlanView.tsx**: `campMode` prop 추가 → `PlanCard`에 전달
- **DailyPlanListView.tsx**: `campMode` prop 추가 → `PlanCard`에 전달
- **TodayPlanListView.tsx**: `campMode` prop 추가 → `DailyPlanView`와 `SinglePlanView`에 전달
- **PlanViewContainer.tsx**: 기존 `campMode` prop을 `DailyPlanListView`와 `SinglePlanView`에 전달

## ✅ 수정 결과

### 정상 동작 확인

1. **일반 Today 모드 (`/today`)**
   - 플랜 완료 관련 네비게이션 → `/today/plan/[planId]` (쿼리 파라미터 없음) ✅
   - 완료 페이지의 뒤로가기 → `/today` ✅

2. **캠프 학습 관리 모드 (`/camp/today`)**
   - 플랜 완료 관련 네비게이션 → `/today/plan/[planId]?mode=camp` ✅
   - 완료 페이지의 뒤로가기 → `/camp/today` ✅
   - 캠프 모드 UI 및 텍스트 표시 ✅

3. **PlanExecutionForm**
   - 모드에 따라 올바르게 리다이렉트:
     - `mode="today"` → `/today?completedPlanId=...` ✅
     - `mode="camp"` → `/camp/today?completedPlanId=...` ✅

## 📋 수정된 파일 목록

1. `app/(student)/today/_components/PlanItem.tsx`
2. `app/(student)/today/_components/PlanGroupCard.tsx`
3. `app/(student)/today/_components/TimerControlButtons.tsx`
4. `app/(student)/today/_components/PlanCard.tsx`
5. `app/(student)/today/_components/PlanTimerCard.tsx`
6. `app/(student)/today/_components/DailyPlanView.tsx`
7. `app/(student)/today/_components/SinglePlanView.tsx`
8. `app/(student)/today/_components/DailyPlanListView.tsx`
9. `app/(student)/today/_components/TodayPlanListView.tsx`
10. `app/(student)/today/_components/PlanViewContainer.tsx`

## 🔗 관련 파일

- `app/(student)/camp/today/page.tsx` - 캠프 학습 관리 페이지 (이미 `campMode={true}` 전달)
- `app/(student)/today/page.tsx` - 일반 학습 관리 페이지 (기본값 `campMode={false}`)
- `app/(student)/today/plan/[planId]/page.tsx` - 플랜 실행 페이지 (이미 모드 처리 구현됨)
- `app/(student)/today/plan/[planId]/_components/PlanExecutionForm.tsx` - 완료 폼 (이미 모드 처리 구현됨)

## 📝 참고 사항

### Prop 전달 체인

```
PlanViewContainer (campMode)
  ├─ DailyPlanListView (campMode)
  │   └─ PlanCard (campMode)
  │       └─ (내부 완료 핸들러)
  └─ SinglePlanView (campMode)
      └─ PlanCard (campMode)
          └─ (내부 완료 핸들러)

PlanViewContainer (campMode)
  └─ DailyPlanView (campMode) [TodayPlanListView 경로]
      └─ PlanGroupCard (campMode)
          ├─ PlanItem (campMode)
          │   └─ TimerControlButtons (campMode)
          └─ TimerControlButtons (campMode)
```

### 네비게이션 경로 정리

| 출발 페이지 | 컴포넌트 | 액션 | 이동 경로 | 모드 |
|-----------|---------|------|----------|-----|
| `/today` | PlanItem | 완료 | `/today/plan/[id]` | 일반 ✅ |
| `/today` | PlanCard | 완료 | `/today/plan/[id]` | 일반 ✅ |
| `/today` | TimerControlButtons | 상세보기 | `/today/plan/[id]` | 일반 ✅ |
| `/camp/today` | PlanItem | 완료 | `/today/plan/[id]?mode=camp` | 캠프 ✅ |
| `/camp/today` | PlanCard | 완료 | `/today/plan/[id]?mode=camp` | 캠프 ✅ |
| `/camp/today` | TimerControlButtons | 상세보기 | `/today/plan/[id]?mode=camp` | 캠프 ✅ |

---

**작업 날짜**: 2025년 1월 27일  
**작업자**: AI Assistant

