# 스케줄 캐시 에러 수정

## 문제 상황

### 에러 메시지
```
Cannot read properties of undefined (reading 'map')
at generateCacheKey (lib/utils/scheduleCache.ts:45:47)
```

### 원인
1. **필드명 불일치**: `SchedulePreviewPanel`에서 생성하는 `scheduleParams` 객체가 `ScheduleCalculationParams` 타입과 필드명이 일치하지 않았습니다.
   - `WizardData`는 `academy_schedules` (snake_case)를 사용
   - `ScheduleCalculationParams`는 `academySchedules` (camelCase)를 사용
2. **undefined 처리 누락**: `generateCacheKey` 함수에서 `academySchedules`가 undefined일 경우를 처리하지 않았습니다.
3. **서버 액션 호출 시 필드 누락**: `calculateScheduleAvailability`를 호출할 때 필요한 추가 필드(`blocks`, `isTemplateMode`, `isCampMode`, `campTemplateId`)가 전달되지 않았습니다.

## 수정 내용

### 1. `lib/utils/scheduleCache.ts`

**변경 전:**
```typescript
academySchedules: params.academySchedules.map((s) => ({
  // ...
}))
```

**변경 후:**
```typescript
academySchedules: (params.academySchedules || []).map((s) => ({
  // ...
}))
```

- `academySchedules`와 `exclusions`가 undefined일 경우를 안전하게 처리하도록 수정했습니다.

### 2. `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

#### 2.1 `scheduleParams` 필드명 변환

**변경 전:**
```typescript
return {
  period_start: data.period_start,
  period_end: data.period_end,
  scheduler_type: data.scheduler_type,
  block_set_id: data.block_set_id || "default",
  exclusions: data.exclusions || [],
  academy_schedules: data.academy_schedules || [],
  // ...
};
```

**변경 후:**
```typescript
return {
  periodStart: data.period_start,
  periodEnd: data.period_end,
  schedulerType: data.scheduler_type as "1730_timetable",
  blockSetId: data.block_set_id || "default",
  exclusions: data.exclusions || [],
  academySchedules: data.academy_schedules || [],
  schedulerOptions: data.scheduler_options,
  timeSettings: data.time_settings,
};
```

- `ScheduleCalculationParams` 타입에 맞게 필드명을 camelCase로 변환했습니다.

#### 2.2 `calculateSchedule` 함수 개선

**변경 전:**
```typescript
const calculatedResult = await calculateScheduleAvailability(params);
```

**변경 후:**
```typescript
const calculatedResult = await calculateScheduleAvailability({
  ...params,
  blocks: selectedBlockSetBlocks,
  isTemplateMode,
  isCampMode,
  campTemplateId: isCampMode ? campTemplateId : undefined,
});

if (!calculatedResult.success || !calculatedResult.data) {
  throw new Error(calculatedResult.error || "스케줄 계산에 실패했습니다.");
}

const result = calculatedResult.data;
```

- 필요한 추가 필드들을 전달하도록 수정했습니다.
- 서버 액션의 반환값을 올바르게 처리하도록 수정했습니다.

## 테스트

다음 시나리오에서 정상 동작을 확인했습니다:

1. ✅ 학원 일정이 없는 경우
2. ✅ 학원 일정이 있는 경우
3. ✅ 템플릿 모드
4. ✅ 캠프 모드
5. ✅ 일반 모드

## 관련 파일

- `lib/utils/scheduleCache.ts`
- `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

## 참고

- `ScheduleCalculationParams` 타입은 `lib/utils/scheduleCache.ts`에 정의되어 있습니다.
- `calculateScheduleAvailability` 액션은 `app/(student)/actions/calculateScheduleAvailability.ts`에 정의되어 있습니다.

