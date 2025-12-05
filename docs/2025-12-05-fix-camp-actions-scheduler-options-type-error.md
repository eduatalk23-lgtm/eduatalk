# 캠프 액션 SchedulerOptions 타입 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:
```
./app/(student)/actions/campActions.ts:543:42
Type error: Property 'template_block_set_id' does not exist on type 'SchedulerOptions'.
```

## 원인 분석
`SchedulerOptions` 타입에 `template_block_set_id` 속성이 정의되어 있지 않지만, 코드에서는 `scheduler_options`에 이 속성을 동적으로 추가하고 있었습니다. 543번 라인에서 타입 체크를 하려고 했지만, 타입 정의에 없어서 에러가 발생했습니다.

## 수정 내용

### 파일
- `app/(student)/actions/campActions.ts`

### 변경 사항
`creationData.scheduler_options?.template_block_set_id`를 체크하는 부분에 타입 단언(`as any`)을 추가하여 타입 에러를 해결했습니다.

```typescript
// 수정 전
if (!creationData.scheduler_options?.template_block_set_id && blockSetId) {
  // ...
}

// 수정 후
if (!(creationData.scheduler_options as any)?.template_block_set_id && blockSetId) {
  // ...
}
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `SchedulerOptions` 타입은 `lib/types/plan.ts`에 정의되어 있으며, `template_block_set_id`는 타입 정의에 포함되어 있지 않습니다.
- 코드의 다른 부분(554번 라인)에서는 이미 `(creationData.scheduler_options as any).template_block_set_id`를 사용하고 있었습니다.
- `template_block_set_id`는 캠프 템플릿의 블록 세트 ID를 저장하기 위한 동적 속성입니다.
- 향후 `SchedulerOptions` 타입에 `template_block_set_id?: string`을 추가하는 것을 고려할 수 있습니다.

