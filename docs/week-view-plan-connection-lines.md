# 플랜 캘린더 연결 아이콘 디자인 구현

## 작업 개요

주별 플랜 캘린더(WeekView)와 일별 플랜 캘린더(DayView)에서 같은 플랜의 동일 회차를 시각적으로 표시하기 위해 플랜 카드 오른쪽 상단에 연결 아이콘을 추가했습니다.

## 구현 내용

### 1. 플랜 그룹화 로직

같은 플랜의 동일 회차를 식별하기 위해 다음 기준을 사용합니다:

- **우선순위 1**: `plan_number`가 있는 경우 - 같은 `plan_number`를 가진 플랜들을 그룹화
- **우선순위 2**: `plan_number`가 없는 경우 - `content_id` + `sequence` 조합으로 그룹화

```typescript
const groupKey = plan.plan_number !== null && plan.plan_number !== undefined
  ? `plan_number_${plan.plan_number}`
  : plan.sequence !== null && plan.sequence !== undefined
  ? `content_${plan.content_id}_seq_${plan.sequence}`
  : null;
```

### 2. 플랜 카드 위치 추적

각 플랜 카드의 위치를 추적하기 위해:

- `useRef`를 사용하여 각 플랜 카드의 DOM 요소 참조 저장
- `useEffect`를 사용하여 레이아웃 변경 시 위치 업데이트
- 컨테이너 기준 상대 좌표 계산

```typescript
const planRefs = useRef<Map<string, HTMLDivElement>>(new Map());
const [planPositions, setPlanPositions] = useState<Map<string, PlanPosition>>(new Map());
```

### 3. 연결 아이콘 표시

연결된 플랜 카드에 연결 아이콘을 표시합니다:

- **위치**: 플랜 카드 오른쪽 상단 (`absolute top-1.5 right-1.5`)
- **아이콘**: `Link2` (lucide-react)
- **스타일**: 
  - 크기: 14px
  - 색상: indigo-500
  - 투명도: 0.7
  - 두께: 2px

## 기술적 세부사항

### 타입 정의

```typescript
type PlanConnection = {
  planIds: string[];
  groupKey: string;
};
```

### 주요 훅 및 메모이제이션

1. **planConnections**: 같은 플랜 그룹을 식별하는 메모이제이션된 값
2. **connectedPlanIds**: 연결된 플랜 ID를 빠르게 조회하기 위한 Set

### 성능 최적화

- `useMemo`를 사용하여 불필요한 재계산 방지
- `Set`을 사용하여 연결 여부를 O(1) 시간에 확인

## 사용자 경험 개선

1. **간결한 표시**: 연결선 대신 작은 아이콘으로 깔끔하게 표시
2. **명확한 표시**: 연결된 플랜 카드 오른쪽 상단에 아이콘으로 표시
3. **시각적 부담 감소**: 복잡한 연결선 없이 아이콘만으로 연결 상태 파악 가능

## 버그 수정 이력

### 무한 루프 에러 수정 (2025-01-XX)

**문제**: `useEffect`에서 `setPlanPositions`를 호출할 때 무한 루프 발생

**원인**:
1. `weekDays` 배열이 매 렌더마다 새로 생성되어 `useEffect` 의존성이 계속 변경됨
2. `setPlanPositions` 호출 시 실제 변경 여부를 확인하지 않음

**해결**:
1. `weekDays`와 `weekStart`를 `useMemo`로 메모이제이션
2. `updatePositions`를 `useCallback`으로 메모이제이션
3. 위치 변경 체크 로직 추가 (5px 이상 차이날 때만 업데이트)

```typescript
// 위치 변경 체크
setPlanPositions((prevPositions) => {
  // 크기 비교
  if (prevPositions.size !== newPositions.size) {
    return newPositions;
  }
  
  // 각 위치 비교 (5px 이상 차이나는 경우만 업데이트)
  let hasChanged = false;
  for (const [planId, newPos] of newPositions) {
    const prevPos = prevPositions.get(planId);
    if (!prevPos) {
      hasChanged = true;
      break;
    }
    const dx = Math.abs(prevPos.x - newPos.x);
    const dy = Math.abs(prevPos.y - newPos.y);
    if (dx > 5 || dy > 5) {
      hasChanged = true;
      break;
    }
  }
  
  return hasChanged ? newPositions : prevPositions;
});
```

## 디자인 변경 이력

### 연결선에서 아이콘으로 변경 (2025-01-XX)

**변경 사유**: 연결선 디자인이 복잡하고 시각적 부담이 큼

**변경 내용**:
- SVG 연결선 렌더링 코드 제거
- 플랜 카드 위치 추적 로직 제거 (더 이상 필요 없음)
- 플랜 카드 오른쪽 상단에 `Link2` 아이콘 추가
- 코드 복잡도 감소 및 성능 개선

## 향후 개선 가능 사항

1. **호버 효과**: 연결 아이콘에 마우스를 올렸을 때 관련 플랜들을 강조
2. **색상 구분**: 다른 플랜 그룹에 대해 다른 색상 사용
3. **애니메이션**: 연결 아이콘이 나타날 때 애니메이션 효과 추가
4. **툴팁**: 아이콘에 마우스를 올렸을 때 연결된 플랜 정보 표시

## 파일 변경 사항

### WeekView
- `app/(student)/plan/calendar/_components/WeekView.tsx`
  - 플랜 그룹화 로직 추가
  - 연결된 플랜 ID Set 생성 (빠른 조회)
  - 플랜 카드 오른쪽 상단에 연결 아이콘 추가
  - 불필요한 위치 추적 및 SVG 렌더링 코드 제거

### DayView
- `app/(student)/plan/calendar/_components/DayView.tsx`
  - 플랜 그룹화 로직 추가
  - 연결된 플랜 ID Set 생성
  - TimelineItem에 연결 정보 전달

- `app/(student)/plan/calendar/_components/TimelineItem.tsx`
  - `connectedPlanIds` prop 추가
  - PlanCard에 연결 정보 전달

- `app/(student)/plan/calendar/_components/PlanCard.tsx`
  - `Link2` 아이콘 import 추가
  - 연결 아이콘을 오른쪽 상단에 표시 (`absolute top-2 right-2`)
  - `isConnected` prop이 true일 때만 아이콘 표시

