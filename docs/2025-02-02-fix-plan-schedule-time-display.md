# 플랜 스케줄 시간 표시 문제 수정

## 문제 상황

플랜 생성 시 마지막 단계(Step 7)의 스케줄 결과와 플랜 상세보기의 일별 스케줄에서 모든 플랜이 동일한 시간(`10:00 ~ 10:30`)으로 표시되는 문제가 발생했습니다.

실제 DB에는 각 플랜마다 정확한 `start_time`과 `end_time`이 저장되어 있었지만, 조회 시 이 필드들을 포함하지 않아 `block_index` 기반으로만 시간을 추정하고 있었습니다.

## 원인 분석

1. **DB 조회 쿼리 누락**: `_getScheduleResultData` 함수에서 플랜 조회 시 `start_time`, `end_time` 필드를 포함하지 않음
2. **타입 정의 누락**: `Plan` 타입과 반환 타입에 `start_time`, `end_time` 필드가 없음
3. **시간 추정 로직**: `getPlanStartTime` 함수가 DB의 실제 시간을 사용하지 않고 `block_index` 기반으로만 추정

## 수정 내용

### 1. `scheduleTypes.ts` - Plan 타입에 필드 추가

```typescript
export type Plan = {
  // ... 기존 필드들 ...
  start_time?: string | null; // DB에 저장된 실제 시작 시간
  end_time?: string | null; // DB에 저장된 실제 종료 시간
};
```

### 2. `queries.ts` - 플랜 조회 쿼리 수정

**Select 쿼리에 필드 추가:**
```typescript
.select(
  "id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,plan_number,sequence,start_time,end_time"
)
```

**반환 타입에 필드 추가:**
```typescript
plans: Array<{
  // ... 기존 필드들 ...
  start_time: string | null;
  end_time: string | null;
}>;
```

**반환 객체에 필드 추가:**
```typescript
return {
  // ... 기존 필드들 ...
  start_time: p.start_time ?? null,
  end_time: p.end_time ?? null,
};
```

### 3. `scheduleUtils.ts` - getPlanStartTime 함수 수정

DB에 저장된 `start_time`을 우선 사용하도록 수정:

```typescript
export function getPlanStartTime(
  plan: Plan,
  date: string,
  blocks: BlockData[]
): string | null {
  // DB에 저장된 start_time이 있으면 우선 사용
  if (plan.start_time) {
    return plan.start_time;
  }

  // 없으면 block_index 기반으로 추정 (기존 로직)
  // ...
}
```

## 결과

이제 플랜 스케줄 표시 시:
- DB에 저장된 실제 `start_time`과 `end_time`이 우선적으로 사용됩니다
- 각 플랜이 정확한 시간대로 표시됩니다
- `block_index` 기반 추정은 `start_time`이 없는 경우에만 fallback으로 사용됩니다

## 관련 파일

- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleTypes.ts`
- `app/(student)/actions/plan-groups/queries.ts`
- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`

## 테스트 확인 사항

1. 플랜 생성 후 Step 7 스케줄 결과에서 각 플랜의 시간이 정확히 표시되는지 확인
2. 플랜 상세보기에서 일별 스케줄의 시간이 정확히 표시되는지 확인
3. CSV 데이터와 화면 표시가 일치하는지 확인

