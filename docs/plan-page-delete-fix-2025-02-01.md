# 플랜 페이지 삭제 후 UI 업데이트 문제 수정

**작업 일자**: 2025-02-01  
**작업 내용**: 플랜 그룹 삭제 후 재조정 추천 영역과 플랜 목록이 남아있는 문제 수정

## 문제 상황

`/plan` 페이지에서 플랜 그룹을 삭제한 후에도:
- 재조정 추천 영역(`RescheduleRecommendations`)이 삭제된 플랜 그룹을 포함하여 표시됨
- 플랜 목록(`PlanGroupList`)이 삭제된 플랜 그룹을 포함하여 표시됨

## 원인 분석

1. **클라이언트 컴포넌트의 상태 관리 문제**
   - `RescheduleRecommendations`는 클라이언트 컴포넌트로 `useEffect`로 데이터를 로드
   - 삭제 후 `router.refresh()`가 호출되어도 클라이언트 컴포넌트는 자동으로 다시 로드되지 않음
   - 컴포넌트가 재마운트되지 않아 이전 상태가 유지됨

2. **Prop 업데이트 문제**
   - `PlanGroupList`는 서버에서 받은 `groups` prop을 사용
   - 삭제 후 `router.refresh()`가 호출되어도 클라이언트 컴포넌트는 prop이 변경될 때까지 업데이트되지 않을 수 있음

## 해결 방법

### 1. Key를 사용한 컴포넌트 재마운트

플랜 그룹 개수를 `key`로 사용하여 플랜 그룹이 변경될 때마다 컴포넌트가 재마운트되도록 수정:

```typescript
// app/(student)/plan/page.tsx

{/* 재조정 추천 - 플랜 그룹이 있을 때만 표시 */}
{planGroups.length > 0 && (
  <RescheduleRecommendations 
    key={planGroups.length} 
    studentId={user.id} 
  />
)}

{/* 플랜 목록 섹션 */}
{planGroups.length > 0 ? (
  <PlanGroupList 
    key={planGroups.length}
    groups={planGroups} 
    planCounts={planCounts}
    planProgressData={planProgressData}
  />
) : (
  <EmptyState ... />
)}
```

### 2. 조건부 렌더링 추가

플랜 그룹이 없을 때 `RescheduleRecommendations`를 표시하지 않도록 조건부 렌더링 추가:

```typescript
{planGroups.length > 0 && (
  <RescheduleRecommendations 
    key={planGroups.length} 
    studentId={user.id} 
  />
)}
```

## 수정된 파일

1. **app/(student)/plan/page.tsx**
   - `RescheduleRecommendations`에 `key={planGroups.length}` 추가
   - `RescheduleRecommendations`를 플랜 그룹이 있을 때만 표시하도록 조건부 렌더링 추가
   - `PlanGroupList`에 `key={planGroups.length}` 추가

2. **app/(student)/plan/_components/RescheduleRecommendations.tsx**
   - 불필요한 focus 이벤트 리스너 제거 (key를 사용하면 자동으로 재마운트되므로 불필요)

## 동작 원리

1. 플랜 그룹 삭제 시 `router.refresh()` 호출
2. 서버에서 새로운 플랜 그룹 데이터를 가져옴
3. `planGroups.length`가 변경되면 `key`가 변경됨
4. React가 `key` 변경을 감지하여 컴포넌트를 완전히 재마운트
5. 재마운트 시 `useEffect`가 다시 실행되어 최신 데이터를 로드
6. 삭제된 플랜 그룹이 더 이상 표시되지 않음

## 테스트 시나리오

1. 플랜 그룹이 있는 상태에서 `/plan` 페이지 접속
2. 플랜 그룹 삭제
3. 재조정 추천 영역이 삭제된 플랜 그룹을 포함하지 않는지 확인
4. 플랜 목록이 삭제된 플랜 그룹을 포함하지 않는지 확인
5. 모든 플랜 그룹을 삭제한 경우 재조정 추천 영역이 표시되지 않는지 확인

## 참고 사항

- `key`를 사용한 재마운트는 컴포넌트의 모든 상태를 초기화하므로, 필요에 따라 상태를 보존해야 하는 경우 다른 방법을 고려해야 함
- 플랜 그룹 개수만으로는 정확한 변경 감지가 어려울 수 있지만, 삭제 시 개수가 변경되므로 이 방법으로 충분함
- 더 정확한 변경 감지를 위해서는 플랜 그룹 ID 목록을 `key`로 사용할 수 있지만, 현재 구현으로도 충분함

