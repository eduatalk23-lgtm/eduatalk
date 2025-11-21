# 플랜 캘린더 쪼개진 플랜 연결선 표시 기능

## 작업 개요

플랜 캘린더에서 같은 `plan_number`를 가진 쪼개진 플랜들을 시각적으로 연결하는 기능을 추가했습니다. 같은 날짜 내에서 같은 플랜 번호를 가진 플랜들이 2개 이상일 경우, 연결선으로 표시하여 하나의 플랜이 여러 블록으로 나뉘어 있음을 명확히 보여줍니다.

## 구현 내용

### 1. PlanCard 컴포넌트에 연결 상태 props 추가

**파일**: `app/(student)/plan/calendar/_components/PlanCard.tsx`

```typescript
type PlanCardProps = {
  plan: PlanWithContent;
  compact?: boolean;
  showTime?: boolean;
  showProgress?: boolean;
  // 연결 상태 (같은 plan_number를 가진 쪼개진 플랜들)
  isConnected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isMiddle?: boolean;
};
```

**연결선 스타일링**:
- 연결된 플랜들의 border와 rounded 스타일을 조정
- 첫 번째 플랜: 위쪽만 둥글게 (`rounded-t-md`)
- 마지막 플랜: 아래쪽만 둥글게 (`rounded-b-md`)
- 중간 플랜: 둥글게 없음 (`rounded-none`)
- 연결선: 각 플랜의 아래쪽에 3px 높이의 선 표시

### 2. MonthView에서 연결 상태 계산 로직 추가

**파일**: `app/(student)/plan/calendar/_components/MonthView.tsx`

**주요 로직**:
1. 날짜별로 플랜들을 그룹화
2. 같은 `plan_number`를 가진 플랜들을 찾아 그룹화
3. 2개 이상인 경우 연결 상태 계산
4. `block_index` 순으로 정렬하여 첫 번째, 중간, 마지막 구분
5. 각 플랜에 연결 상태 정보 전달

```typescript
// 같은 plan_number를 가진 플랜들의 연결 상태 계산
const getPlanConnectionState = useMemo(() => {
  const connectionMap = new Map<string, {
    isConnected: boolean;
    isFirst: boolean;
    isLast: boolean;
    isMiddle: boolean;
  }>();
  
  // 날짜별로 그룹화
  plansByDate.forEach((dayPlans, date) => {
    // 같은 plan_number를 가진 플랜들을 그룹화
    const planNumberGroups = new Map<number | null, PlanWithContent[]>();
    
    dayPlans.forEach((plan) => {
      const planNumber = plan.plan_number;
      if (!planNumberGroups.has(planNumber)) {
        planNumberGroups.set(planNumber, []);
      }
      planNumberGroups.get(planNumber)!.push(plan);
    });
    
    // 각 그룹에서 2개 이상인 경우 연결 상태 계산
    planNumberGroups.forEach((groupPlans, planNumber) => {
      if (groupPlans.length >= 2 && planNumber !== null) {
        // block_index 순으로 정렬
        const sortedPlans = [...groupPlans].sort((a, b) => a.block_index - b.block_index);
        
        sortedPlans.forEach((plan, index) => {
          const isFirst = index === 0;
          const isLast = index === sortedPlans.length - 1;
          const isMiddle = !isFirst && !isLast;
          
          connectionMap.set(`${date}-${plan.id}`, {
            isConnected: true,
            isFirst,
            isLast,
            isMiddle,
          });
        });
      }
    });
  });
  
  return (date: string, planId: string) => {
    return connectionMap.get(`${date}-${planId}`) || {
      isConnected: false,
      isFirst: false,
      isLast: false,
      isMiddle: false,
    };
  };
}, [plansByDate]);
```

### 3. 연결 상태를 PlanCard에 전달

**학습시간 슬롯의 플랜들**:
```typescript
// 연결 상태 계산
const connectionState = getPlanConnectionState(dateStr, plan.id);

<PlanCard
  key={plan.id}
  plan={plan}
  compact={true}
  showTime={false}
  showProgress={false}
  isConnected={connectionState.isConnected}
  isFirst={connectionState.isFirst}
  isLast={connectionState.isLast}
  isMiddle={connectionState.isMiddle}
/>
```

**타임라인 슬롯에 매칭되지 않은 플랜들**:
```typescript
// 연결 상태 계산
const connectionState = getPlanConnectionState(dateStr, plan.id);

<PlanCard
  key={plan.id}
  plan={plan}
  compact={true}
  showTime={false}
  showProgress={false}
  isConnected={connectionState.isConnected}
  isFirst={connectionState.isFirst}
  isLast={connectionState.isLast}
  isMiddle={connectionState.isMiddle}
/>
```

## 시각적 효과

### 연결된 플랜들의 스타일

1. **첫 번째 플랜**:
   - 위쪽만 둥글게 (`rounded-t-md`)
   - 아래 border 제거 (`border-b-0`)
   - 아래쪽에 연결선 표시

2. **중간 플랜**:
   - 둥글게 없음 (`rounded-none`)
   - 위아래 border 제거 (`border-t-0 border-b-0`)
   - 아래쪽에 연결선 표시

3. **마지막 플랜**:
   - 아래쪽만 둥글게 (`rounded-b-md`)
   - 위 border 제거 (`border-t-0`)
   - 연결선 없음

### 연결선 스타일

- 높이: 3px
- 위치: 각 플랜의 아래쪽 (마지막 플랜 제외)
- 색상: 플랜 상태에 따라 변경
  - 완료: `bg-green-300`
  - 진행 중: `bg-blue-300`
  - 대기: `bg-gray-200`
- z-index: 10 (다른 요소 위에 표시)

## 동작 방식

1. **같은 날짜 내에서만 연결**: 다른 날짜에 있는 같은 `plan_number`의 플랜들은 연결되지 않습니다.
2. **최소 2개 이상**: 같은 `plan_number`를 가진 플랜이 2개 이상일 때만 연결선이 표시됩니다.
3. **block_index 순서**: `block_index` 순으로 정렬하여 연결 순서를 결정합니다.

## 제한 사항

- 현재는 **같은 날짜 내에서만** 연결선이 표시됩니다.
- 다른 날짜에 걸쳐 있는 쪼개진 플랜들은 연결되지 않습니다.
- 월별 뷰에서만 구현되었으며, 주별/일별 뷰에는 아직 적용되지 않았습니다.

## 향후 개선 사항

1. **주별/일별 뷰에도 적용**: WeekView와 DayView에도 같은 기능 추가
2. **다른 날짜 간 연결**: 날짜를 넘나드는 쪼개진 플랜들도 표시 (선택적)
3. **연결선 애니메이션**: 호버 시 연결선 강조 효과
4. **연결된 플랜 그룹 정보**: 연결된 플랜들의 총 개수나 진행률 표시

## 관련 파일

- `app/(student)/plan/calendar/_components/PlanCard.tsx`: 플랜 카드 컴포넌트
- `app/(student)/plan/calendar/_components/MonthView.tsx`: 월별 뷰 컴포넌트
- `app/(student)/plan/calendar/_types/plan.ts`: 플랜 타입 정의

## 커밋 정보

- 커밋 해시: (최신 커밋)
- 커밋 메시지: "feat: 플랜 캘린더에서 쪼개진 플랜들 연결선 표시 기능 추가"

