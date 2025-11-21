# 주별 플랜 캘린더 연결선 디자인 구현

## 작업 개요

주별 플랜 캘린더(WeekView)에서 같은 플랜의 동일 회차를 시각적으로 연결하는 선 디자인을 구현했습니다.

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

### 3. 연결선 렌더링

SVG를 사용하여 연결선을 그립니다:

- **위치**: 요일 헤더 아래, 날짜 카드 위에 오버레이
- **스타일**: 
  - 색상: indigo-500 (`rgb(99, 102, 241)`)
  - 두께: 2px
  - 점선: `strokeDasharray="5 3"`
  - 투명도: 0.6
- **경로**: 날짜 순으로 정렬된 플랜들을 직선으로 연결

### 4. 시각적 피드백

연결된 플랜 카드에 시각적 표시를 추가했습니다:

- `ring-2 ring-indigo-300 ring-opacity-50` 클래스를 추가하여 연결된 플랜임을 표시

## 기술적 세부사항

### 타입 정의

```typescript
type PlanPosition = {
  planId: string;
  date: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PlanConnection = {
  planIds: string[];
  groupKey: string;
};
```

### 주요 훅 및 메모이제이션

1. **planConnections**: 같은 플랜 그룹을 식별하는 메모이제이션된 값
2. **planPositions**: 각 플랜 카드의 위치 정보를 저장하는 상태
3. **connectionPaths**: 연결선 경로를 계산하는 메모이제이션된 값

### 성능 최적화

- `useMemo`를 사용하여 불필요한 재계산 방지
- `useEffect`에서 `resize` 이벤트 리스너 등록/해제로 메모리 누수 방지
- 레이아웃 안정화를 위한 100ms 지연 업데이트

## 사용자 경험 개선

1. **시각적 연결**: 같은 플랜의 동일 회차가 다른 날짜에 분산되어 있어도 한눈에 파악 가능
2. **명확한 표시**: 연결된 플랜 카드에 ring 효과로 강조
3. **부드러운 애니메이션**: 연결선에 transition 효과 적용

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

## 향후 개선 가능 사항

1. **곡선 연결선**: 현재는 직선으로 연결하지만, 베지어 곡선을 사용하여 더 부드러운 연결선 구현 가능
2. **호버 효과**: 연결선에 마우스를 올렸을 때 관련 플랜들을 강조
3. **색상 구분**: 다른 플랜 그룹에 대해 다른 색상 사용
4. **애니메이션**: 연결선이 나타날 때 애니메이션 효과 추가

## 파일 변경 사항

- `app/(student)/plan/calendar/_components/WeekView.tsx`
  - 연결선 관련 타입 정의 추가
  - 플랜 그룹화 로직 추가
  - 위치 추적 로직 추가
  - SVG 연결선 렌더링 추가
  - 연결된 플랜 카드에 시각적 표시 추가

