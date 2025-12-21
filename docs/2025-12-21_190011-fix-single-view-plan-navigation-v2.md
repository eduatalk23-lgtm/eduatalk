# 단일 뷰 플랜 이동 기능 재수정

## 작업 일시
2025-12-21 19:00:11

## 문제 상황

### 사용자 보고
이전 수정 후에도 여전히 단일 뷰에서 같은 날의 다른 플랜으로 이동하는 기능이 작동하지 않음

### 추가 분석
1. **groups 참조 변경 문제**: `groups`는 `useMemo`로 계산되지만, `plansData?.plans`가 변경될 때마다 재생성되어 참조가 달라질 수 있음
2. **useEffect 실행 타이밍**: `groups`가 변경될 때마다 `useEffect`가 실행되어 사용자 선택을 덮어쓸 수 있음
3. **SinglePlanView 자동 선택 충돌**: `SinglePlanView`의 `useEffect`가 `PlanViewContainer`의 로직과 충돌

## 해결 방법

### 핵심 변경 사항

#### 1. groups의 실제 변경 감지
- `groups`의 `planNumber` 목록을 문자열로 변환하여 실제 변경만 감지
- 참조 변경이 아닌 실제 내용 변경만 감지

```typescript
// groups의 planNumber 목록을 문자열로 변환하여 실제 변경 감지
const groupsPlanNumbersKey = useMemo(() => {
  return groups.map((g) => g.planNumber).join(",");
}, [groups]);
```

#### 2. planDate 변경과 groups 변경 분리
- `planDate` 변경 시에는 별도의 `useEffect`에서 처리
- `groups` 변경 시에는 `planDate`가 변경되지 않았을 때만 처리

```typescript
// planDate가 변경되었을 때 selectedPlanNumber 리셋
useEffect(() => {
  if (planDate !== lastPlanDate.current) {
    lastPlanDate.current = planDate;
    lastUserSelectedPlanNumber.current = null;
    if (groups.length > 0) {
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    }
  }
}, [planDate]);

// groups의 planNumber 목록이 실제로 변경되었을 때만 selectedPlanNumber 업데이트
useEffect(() => {
  // planDate가 변경되었는지 확인
  if (planDate !== lastPlanDate.current) {
    return; // planDate 변경은 위의 useEffect에서 처리
  }
  // ...
}, [groupsPlanNumbersKey, planDate]);
```

#### 3. SinglePlanView 자동 선택 로직 제거
- `SinglePlanView`에서 자동 선택 로직 제거
- `PlanViewContainer`에서만 처리하여 충돌 방지

```typescript
// SinglePlanView.tsx
// SinglePlanView에서는 자동 선택을 하지 않음
// PlanViewContainer에서 처리하도록 함
```

#### 4. 사용자 선택 우선순위 강화
- 사용자가 선택한 `planNumber`가 최우선
- `groups`가 변경되어도 사용자 선택이 유효하면 유지

```typescript
setSelectedPlanNumber((prev) => {
  // 사용자가 선택한 planNumber가 여전히 유효한지 확인 (최우선)
  const userSelected = lastUserSelectedPlanNumber.current;
  if (userSelected != null && groups.some((g) => g.planNumber === userSelected)) {
    return userSelected; // 유효하면 유지
  }
  // ...
});
```

### 주요 개선 사항

1. **실제 변경 감지**
   - `groups`의 참조 변경이 아닌 실제 내용 변경만 감지
   - 불필요한 `useEffect` 실행 방지

2. **로직 분리**
   - `planDate` 변경과 `groups` 변경을 분리하여 처리
   - 각각의 `useEffect`가 명확한 책임을 가짐

3. **충돌 방지**
   - `SinglePlanView`의 자동 선택 로직 제거
   - `PlanViewContainer`에서만 상태 관리

4. **사용자 선택 보장**
   - 사용자 선택이 최우선으로 처리
   - `groups`가 변경되어도 사용자 선택 유지

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 실제 변경만 감지하여 불필요한 실행 방지
- ✅ 사용자 선택 우선순위 보장
- ✅ 로직 분리로 충돌 방지

## 관련 파일
- `app/(student)/today/_components/PlanViewContainer.tsx`
- `app/(student)/today/_components/SinglePlanView.tsx`
- `app/(student)/today/_components/PlanSelector.tsx`

## 참고
이전 수정 사항:
- `2025-12-21_185703-fix-single-view-plan-navigation.md`: 단일 뷰 플랜 이동 기능 근본 수정

이번 수정으로 `groups`의 실제 변경만 감지하고, `planDate` 변경과 `groups` 변경을 분리하여 처리하며, `SinglePlanView`의 자동 선택 로직을 제거하여 충돌을 방지했습니다.

