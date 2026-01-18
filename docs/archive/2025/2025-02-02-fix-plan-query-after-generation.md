# 플랜 생성 후 조회 문제 수정

## 문제 상황

플랜 생성 후 DB에 저장된 플랜과 화면에 표시되는 플랜이 일치하지 않는 문제가 발생했습니다.

터미널 로그에는 플랜이 정상적으로 저장되고 있지만 (예: "46개 플랜 저장됨"), 화면에는 해당 플랜이 표시되지 않거나 일부만 표시되는 현상이 있었습니다.

## 원인 분석

1. **캐시 무효화 후 즉시 refetch되지 않음**: `invalidateQueries`만으로는 쿼리가 즉시 refetch되지 않을 수 있습니다.
2. **DB 동기화 지연**: 플랜 저장 후 즉시 조회하면 DB 트랜잭션이 완전히 커밋되지 않았을 수 있습니다.
3. **조회 쿼리 로그 부재**: 실제로 조회되는 플랜 수를 확인할 수 없어 디버깅이 어려웠습니다.

## 수정 내용

### 1. 플랜 생성 후 즉시 refetch 추가

`app/(student)/plan/new-group/_components/_features/scheduling/Step7ScheduleResult.tsx`:

```typescript
onSuccess: async () => {
  // 플랜 생성 후 DB 동기화를 위한 짧은 지연
  await new Promise((resolve) => setTimeout(resolve, 500));
  // 플랜 생성 후 관련 쿼리 무효화 및 즉시 refetch
  await queryClient.invalidateQueries({ queryKey: ["plansExist", groupId] });
  await queryClient.invalidateQueries({ queryKey: ["planSchedule", groupId] });
  // 즉시 refetch하여 최신 데이터 표시
  await queryClient.refetchQueries({ queryKey: ["plansExist", groupId] });
  await queryClient.refetchQueries({ queryKey: ["planSchedule", groupId] });
},
```

**변경 사항**:
- `invalidateQueries` 후 `refetchQueries`를 호출하여 즉시 최신 데이터를 가져오도록 수정
- DB 동기화를 위한 500ms 지연 추가

### 2. 플랜 조회 쿼리에 로그 추가

`app/(student)/actions/plan-groups/queries.ts`:

```typescript
// 개발 환경에서 조회된 플랜 수 로깅
if (process.env.NODE_ENV === "development") {
  console.log(`[_getScheduleResultData] 플랜 조회 결과:`, {
    groupId,
    studentId: targetStudentId,
    planCount: plans?.length ?? 0,
    plans: plans?.slice(0, 5).map((p) => ({
      id: p.id,
      plan_date: p.plan_date,
      block_index: p.block_index,
      content_id: p.content_id?.substring(0, 8),
      range: `${p.planned_start_page_or_time}~${p.planned_end_page_or_time}`,
      start_time: p.start_time,
      end_time: p.end_time,
    })),
  });
}
```

**변경 사항**:
- 개발 환경에서 조회된 플랜 수와 상세 정보를 로깅하여 디버깅 용이성 향상
- 저장된 플랜 수와 조회된 플랜 수를 비교할 수 있도록 함

## 검증 방법

1. 플랜 생성 후 터미널 로그 확인:
   - `[_generatePlansFromGroupRefactored] 플랜 저장 성공: N개 플랜 저장됨`
   - `[_getScheduleResultData] 플랜 조회 결과: { planCount: N, ... }`

2. 저장된 플랜 수와 조회된 플랜 수가 일치하는지 확인

3. 화면에 표시되는 플랜 수가 조회된 플랜 수와 일치하는지 확인

## 추가 수정: 플랜 생성 메시지 수치 일치

### 문제
플랜 생성 후 반환되는 `count` 값이 스케줄러가 생성한 원본 플랜 수(`scheduledPlans.length`)를 반환하여, episode별 분할 후 실제 저장된 플랜 수와 불일치했습니다.

### 수정
`app/(student)/actions/plan-groups/generatePlansRefactored.ts`:

```typescript
// 실제 저장된 플랜 수 반환 (episode별 분할 후 실제 저장된 수)
return { count: insertedData?.length ?? 0 };
```

**변경 사항**:
- 반환값을 실제 저장된 플랜 수(`insertedData.length`)로 변경
- 로그 메시지에 스케줄러 원본 수도 함께 표시하여 비교 가능하도록 함

**영향받는 사용자 메시지**:
- `usePlanGenerator.ts`: `플랜이 생성되었습니다. (총 ${result.count}개)`
- `PlanPreviewDialog.tsx`: `${result.count}개의 플랜이 생성되었습니다.`

## 관련 파일

- `app/(student)/plan/new-group/_components/_features/scheduling/Step7ScheduleResult.tsx`
- `app/(student)/actions/plan-groups/queries.ts`
- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

## 참고

- React Query의 `invalidateQueries`는 쿼리를 무효화하지만 즉시 refetch하지 않을 수 있습니다.
- `refetchQueries`를 사용하면 쿼리를 즉시 refetch할 수 있습니다.
- DB 트랜잭션 완료를 보장하기 위해 짧은 지연을 추가하는 것이 안전합니다.
- Episode별 분할로 인해 실제 저장된 플랜 수가 스케줄러 원본 수보다 많을 수 있습니다.

