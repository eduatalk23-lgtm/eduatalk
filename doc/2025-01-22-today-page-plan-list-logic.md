# /today 페이지 플랜 목록 표시 로직

## 개요

일일 뷰에서 각 플랜 그룹의 하단에 표시되는 플랜 목록 영역의 구현 로직을 설명합니다.

## UI 구조

```html
<div class="flex flex-col gap-2">
  <!-- 각 플랜 항목 -->
  <div class="flex items-center gap-2 rounded border border-gray-200 bg-white p-2">
    <!-- 완료 체크박스 -->
    <button>체크박스 아이콘</button>
    
    <!-- 플랜 정보 -->
    <div class="flex-1 text-xs">
      <div>블록 번호 또는 챕터</div>
      <div>범위 (시작 ~ 종료)</div>
    </div>
    
    <!-- 진행률 바 -->
    <div class="h-1 w-16 rounded-full bg-gray-200">
      <div style="width: 진행률%"></div>
    </div>
  </div>
</div>
```

## 구현 위치

**파일**: `app/(student)/today/_components/PlanCard.tsx`  
**라인**: 364-401 (일일 뷰의 플랜 목록 부분)

## 데이터 흐름

### 1. 플랜 그룹화

```typescript
// PlanViewContainer에서 데이터 로딩
const grouped = groupPlansByPlanNumber(data.plans);

// groupPlansByPlanNumber 함수 (planGroupUtils.ts)
export function groupPlansByPlanNumber(plans: PlanWithContent[]): PlanGroup[] {
  const groups = new Map<number | null, PlanWithContent[]>();
  
  plans.forEach((plan) => {
    const planNumber = plan.plan_number ?? null;
    if (!groups.has(planNumber)) {
      groups.set(planNumber, []);
    }
    groups.get(planNumber)!.push(plan);
  });
  
  return Array.from(groups.entries()).map(([planNumber, plans]) => ({
    planNumber,
    plans: plans.sort((a, b) => (a.block_index ?? 0) - (b.block_index ?? 0)),
    content: plans[0]?.content,
    sequence: plans[0]?.sequence ?? null,
  }));
}
```

**결과**: 같은 `plan_number`를 가진 플랜들이 하나의 그룹으로 묶임

### 2. 플랜 목록 렌더링

```typescript
{group.plans.map((plan) => {
  const isCompleted = !!plan.actual_end_time;
  const progress = plan.progress ?? 0;
  
  return (
    <div key={plan.id} className="...">
      {/* 완료 체크박스 */}
      <button onClick={() => handleToggleCompletion(plan.id, isCompleted)}>
        {isCompleted ? <CheckCircle2 /> : <Circle />}
      </button>
      
      {/* 플랜 정보 */}
      <div>
        <div>{plan.chapter || `블록 ${plan.block_index ?? 0}`}</div>
        <div>{plan.planned_start_page_or_time} ~ {plan.planned_end_page_or_time}</div>
      </div>
      
      {/* 진행률 바 */}
      {progress > 0 && (
        <div style={{ width: `${progress}%` }} />
      )}
    </div>
  );
})}
```

## 주요 로직 설명

### 1. 블록 번호 표시

```typescript
plan.chapter || `블록 ${plan.block_index ?? 0}`
```

**우선순위**:
1. `plan.chapter`가 있으면 챕터명 표시
2. 없으면 `블록 {block_index}` 형식으로 표시
3. `block_index`가 없으면 `블록 0` 표시

**예시**:
- `chapter: "1단원"` → "1단원"
- `chapter: null, block_index: 1` → "블록 1"
- `chapter: null, block_index: 11` → "블록 11"

### 2. 범위 표시

```typescript
{plan.planned_start_page_or_time} ~ {plan.planned_end_page_or_time}
```

**의미**:
- `planned_start_page_or_time`: 계획된 시작 페이지 또는 시간
- `planned_end_page_or_time`: 계획된 종료 페이지 또는 시간

**콘텐츠 타입별 의미**:
- `book`: 페이지 번호 (예: 1 ~ 14)
- `lecture`: 시간 (초 단위, 예: 0 ~ 3600)
- `custom`: 페이지 또는 시간

### 3. 완료 상태 체크

```typescript
const isCompleted = !!plan.actual_end_time;
```

**로직**:
- `actual_end_time`이 있으면 완료된 플랜
- 없으면 미완료 플랜

**아이콘**:
- 완료: `CheckCircle2` (녹색)
- 미완료: `Circle` (회색)

### 4. 진행률 표시

```typescript
const progress = plan.progress ?? 0;

{progress > 0 && (
  <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-200">
    <div
      className="h-full bg-indigo-500"
      style={{ width: `${progress}%` }}
    />
  </div>
)}
```

**조건**: `progress > 0`일 때만 표시

**표시 방식**:
- 전체 너비: 16 (4rem)
- 진행률에 따라 인디고색 바의 너비가 변경됨
- 예: `progress: 12` → 12% 너비

### 5. 완료 토글 기능

```typescript
const handleToggleCompletion = async (planId: string, isCompleted: boolean) => {
  setIsLoading(true);
  try {
    const result = await togglePlanCompletion(planId, !isCompleted);
    if (!result.success) {
      alert(result.error || "완료 상태 변경에 실패했습니다.");
    } else {
      router.refresh();
    }
  } catch (error) {
    alert("오류가 발생했습니다.");
  } finally {
    setIsLoading(false);
  }
};
```

**동작**:
1. 체크박스 클릭
2. 현재 완료 상태의 반대로 변경
3. `togglePlanCompletion` 액션 호출
4. 성공 시 페이지 새로고침

## 왜 같은 범위를 가진 블록이 여러 개 나오는가?

### 원인

같은 `plan_number`를 가진 플랜들이 여러 블록에 걸쳐 분할되어 있을 수 있습니다.

**예시**:
- 플랜 번호 1: 1페이지 ~ 14페이지
  - 블록 1: 1페이지 ~ 14페이지 (전체)
  - 블록 11: 1페이지 ~ 14페이지 (같은 범위, 다른 블록)

**가능한 시나리오**:
1. **시간대 분할**: 같은 학습 범위를 여러 시간대에 배정
2. **일시정지 후 재개**: 학습 중 일시정지 후 다른 블록에서 재개
3. **플랜 재조정**: 플랜이 재조정되면서 같은 범위가 여러 블록에 배정됨

### 해결 방법

현재는 각 블록을 개별적으로 표시하고 있습니다. 향후 개선 방안:

1. **중복 제거**: 같은 범위를 가진 블록들을 하나로 합쳐서 표시
2. **블록 개수 표시**: "블록 1 (3개 블록)" 형식으로 표시 (현재 단일 뷰에만 적용됨)
3. **시간대 정보 추가**: 각 블록의 시간대 정보 표시

## 데이터 구조 예시

```typescript
group = {
  planNumber: 1,
  plans: [
    {
      id: "plan-1",
      block_index: 1,
      chapter: null,
      planned_start_page_or_time: 1,
      planned_end_page_or_time: 14,
      progress: 12,
      actual_end_time: null,
      // ...
    },
    {
      id: "plan-2",
      block_index: 11,
      chapter: null,
      planned_start_page_or_time: 1,
      planned_end_page_or_time: 14,
      progress: 12,
      actual_end_time: null,
      // ...
    }
  ],
  content: { /* 콘텐츠 정보 */ },
  sequence: 1
}
```

## 스타일링

### 레이아웃
- `flex flex-col gap-2`: 세로 배치, 0.5rem 간격
- 각 항목: `flex items-center gap-2`: 가로 배치, 중앙 정렬

### 색상
- 배경: `bg-white`
- 테두리: `border-gray-200`
- 텍스트: `text-gray-900` (제목), `text-gray-500` (범위)
- 진행률 바: `bg-indigo-500`

### 크기
- 텍스트: `text-xs` (12px)
- 진행률 바: `h-1` (4px 높이), `w-16` (64px 너비)
- 아이콘: `h-5 w-5` (20px)

## 개선 제안

### 1. 중복 블록 표시 개선

```typescript
// 같은 범위를 가진 블록들을 그룹화
const rangeGroups = new Map<string, Plan[]>();
group.plans.forEach((plan) => {
  const rangeKey = `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
  if (!rangeGroups.has(rangeKey)) {
    rangeGroups.set(rangeKey, []);
  }
  rangeGroups.get(rangeKey)!.push(plan);
});

// 그룹별로 표시
rangeGroups.forEach((plans, rangeKey) => {
  if (plans.length > 1) {
    // 여러 블록이 같은 범위를 가지는 경우
    // "블록 1, 11 (1 ~ 14)" 형식으로 표시
  } else {
    // 단일 블록인 경우 기존 방식대로 표시
  }
});
```

### 2. 시간대 정보 추가

```typescript
<div className="text-gray-500">
  {plan.planned_start_page_or_time} ~ {plan.planned_end_page_or_time}
  {plan.start_time && plan.end_time && (
    <span className="ml-2">
      ({plan.start_time} ~ {plan.end_time})
    </span>
  )}
</div>
```

### 3. 진행률 계산 개선

현재는 `plan.progress`를 그대로 사용하지만, 실제 완료량을 기반으로 계산할 수도 있습니다:

```typescript
const actualProgress = plan.completed_amount && plan.planned_end_page_or_time && plan.planned_start_page_or_time
  ? Math.round(
      ((plan.completed_amount) / 
       (plan.planned_end_page_or_time - plan.planned_start_page_or_time)) * 100
    )
  : plan.progress ?? 0;
```

## 참고사항

- 각 플랜은 고유한 `id`를 가지고 있어 `key={plan.id}`로 구분
- 같은 `plan_number`를 가진 플랜들은 하나의 논리적 플랜으로 그룹화됨
- `block_index`는 같은 날짜 내에서의 블록 순서를 나타냄
- 진행률은 0-100 사이의 값이며, 0이면 진행률 바가 표시되지 않음

