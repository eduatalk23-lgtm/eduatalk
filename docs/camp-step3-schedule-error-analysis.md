# 캠프 Step3 스케줄 계산 오류 분석 및 해결 방안

## 🔍 문제 상황

캠프 참여 페이지의 Step3 (스케줄 확인) 단계에서 다음 오류가 발생:

```
스케줄 계산에 실패했습니다. 입력값을 확인해주세요.
```

## 📋 오류 발생 지점 분석

### 1. 오류 메시지 출처

오류 메시지는 `lib/errors/planGroupErrors.ts`의 `SCHEDULE_CALCULATION_FAILED` 에러 코드에서 발생합니다:

```typescript
[PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED]: '스케줄 계산에 실패했습니다. 입력값을 확인해주세요.',
```

### 2. 오류 발생 경로

```
Step2_5SchedulePreview (Step3)
  ↓
calculateScheduleAvailability (Server Action)
  ↓
calculateAvailableDates (스케줄 계산 로직)
  ↓
오류 발생 → 에러 메시지 표시
```

## 🔎 주요 원인 분석

### 원인 1: 필수 필드 누락

**위치**: `app/(student)/camp/[invitationId]/page.tsx`

템플릿 데이터에서 필수 필드가 누락될 수 있습니다:

```typescript
// 템플릿 데이터를 initialData로 변환
const templateData = template.template_data as any;

const initialData = {
  ...templateData,
  // period_start, period_end, block_set_id 등이 없을 수 있음
};
```

**검증 포인트**:

- `period_start`: 학습 기간 시작일
- `period_end`: 학습 기간 종료일
- `block_set_id`: 블록 세트 ID
- `scheduler_type`: 스케줄러 유형

### 원인 2: 블록 세트 문제 (해결됨 ✅)

**위치**: `app/(student)/actions/calculateScheduleAvailability.ts`

**문제점**:

1. **캠프 템플릿의 블록 세트는 `template_block_sets` 테이블에 있음**

   - 템플릿에 `block_set_id`가 있지만, 이는 `template_block_sets` 테이블의 ID
   - 기존 로직은 `student_block_schedule` 테이블에서만 조회하여 캠프 템플릿의 블록을 찾을 수 없음

2. **블록 조회 로직이 캠프 모드를 고려하지 않음**
   - 일반 모드: `student_block_schedule` 테이블에서 조회
   - 캠프 모드: `template_blocks` 테이블에서 조회해야 함

**해결 방법**:

- 캠프 모드일 때는 `template_blocks` 테이블에서 블록 조회
- `isCampMode` 및 `campTemplateId` 파라미터 추가
- 템플릿 블록 세트 존재 여부 및 블록 검증 로직 추가

```typescript
// 수정 전: 항상 student_block_schedule에서 조회
const { data: blocksData } = await supabase
  .from("student_block_schedule")
  .select("day_of_week, start_time, end_time")
  .eq("student_id", user.id)
  .eq("block_set_id", params.blockSetId);

// 수정 후: 캠프 모드일 때는 template_blocks에서 조회
if (params.isCampMode && params.campTemplateId) {
  const { data: blocksData } = await supabase
    .from("template_blocks")
    .select("day_of_week, start_time, end_time")
    .eq("template_block_set_id", params.blockSetId);
} else {
  // 일반 모드: student_block_schedule에서 조회
  const { data: blocksData } = await supabase
    .from("student_block_schedule")
    .select("day_of_week, start_time, end_time")
    .eq("student_id", user.id)
    .eq("block_set_id", params.blockSetId);
}
```

### 원인 3: 날짜 형식 문제

**위치**: `lib/scheduler/calculateAvailableDates.ts`

템플릿 데이터의 날짜 형식이 올바르지 않을 수 있습니다:

```typescript
const startDate = new Date(periodStart);
const endDate = new Date(periodEnd);

if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
  errors.push("올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)");
}
```

**가능한 문제**:

- 날짜 형식이 `YYYY-MM-DD`가 아님
- 날짜 문자열이 null 또는 undefined
- 날짜 범위가 잘못됨 (시작일 > 종료일)

### 원인 4: 제외일 중복

**위치**: `lib/scheduler/calculateAvailableDates.ts`

템플릿 제외일과 학생이 추가한 제외일이 중복될 수 있습니다:

```typescript
// 중복 제외일 확인
const exclusionDates = new Set<string>();
for (const exclusion of exclusions) {
  if (exclusionDates.has(exclusion.exclusion_date)) {
    errors.push(`${exclusion.exclusion_date}: 중복된 제외일이 있습니다.`);
  }
  exclusionDates.add(exclusion.exclusion_date);
}
```

**문제 시나리오**:

- 템플릿에 제외일이 있고, 학생이 같은 날짜를 추가한 경우
- `app/(student)/camp/[invitationId]/page.tsx`에서 중복 체크가 없음

### 원인 5: 템플릿 데이터 구조 불일치

템플릿 데이터의 구조가 예상과 다를 수 있습니다:

```typescript
const templateData = template.template_data as any;
// template_data가 올바른 구조가 아닐 수 있음
```

## 🛠 해결 방안

### 방안 1: 템플릿 데이터 검증 강화

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

템플릿 데이터를 사용하기 전에 필수 필드를 검증합니다:

```typescript
// 템플릿 데이터 검증
const validateTemplateData = (
  templateData: any
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!templateData.period_start || !templateData.period_end) {
    errors.push("템플릿에 학습 기간이 설정되지 않았습니다.");
  }

  if (!templateData.block_set_id) {
    errors.push("템플릿에 블록 세트가 설정되지 않았습니다.");
  }

  if (!templateData.scheduler_type) {
    errors.push("템플릿에 스케줄러 유형이 설정되지 않았습니다.");
  }

  // 날짜 형식 검증
  if (templateData.period_start && templateData.period_end) {
    const startDate = new Date(templateData.period_start);
    const endDate = new Date(templateData.period_end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push("템플릿의 날짜 형식이 올바르지 않습니다.");
    }

    if (startDate > endDate) {
      errors.push("템플릿의 시작일이 종료일보다 늦습니다.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// 사용
const validation = validateTemplateData(templateData);
if (!validation.valid) {
  // 에러 표시 및 처리
}
```

### 방안 2: 블록 세트 존재 여부 확인 (구현 완료 ✅)

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

**수정 내용**:

- 캠프 템플릿의 `block_set_id`는 `template_block_sets` 테이블의 ID이므로, 해당 테이블에서 확인
- 템플릿 블록 세트 존재 여부 및 블록 존재 여부 검증

```typescript
// 수정 후: template_block_sets에서 확인
if (templateData.block_set_id) {
  const { data: templateBlockSet, error: templateBlockSetError } =
    await supabase
      .from("template_block_sets")
      .select("id")
      .eq("id", templateData.block_set_id)
      .eq("template_id", template.id)
      .single();

  if (templateBlockSetError || !templateBlockSet) {
    validationErrors.push(
      `템플릿의 블록 세트(ID: ${templateData.block_set_id})를 찾을 수 없습니다. 관리자에게 문의해주세요.`
    );
  } else {
    // 템플릿 블록 세트에 블록이 있는지 확인
    const { data: templateBlocks } = await supabase
      .from("template_blocks")
      .select("id")
      .eq("template_block_set_id", templateData.block_set_id)
      .limit(1);

    if (!templateBlocks || templateBlocks.length === 0) {
      validationErrors.push(
        "템플릿의 블록 세트에 블록이 없습니다. 관리자에게 문의해주세요."
      );
    }
  }
}
```

### 방안 3: 에러 메시지 개선

**파일**: `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx`

구체적인 오류 원인을 표시하도록 개선:

```typescript
// 현재
if (response.success && response.data) {
  // 성공 처리
} else {
  const error = toPlanGroupError(
    response.error,
    PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED
  );
  setError(error.userMessage);
}

// 개선: 구체적인 에러 메시지 표시
if (response.success && response.data) {
  // 성공 처리
} else {
  // response.error가 구체적인 메시지를 포함하도록 개선
  let errorMessage = "스케줄 계산에 실패했습니다.";

  if (response.error) {
    // 구체적인 에러 메시지 추가
    if (response.error.includes("블록")) {
      errorMessage =
        "블록 세트에 문제가 있습니다. Step 1에서 블록을 확인해주세요.";
    } else if (response.error.includes("날짜")) {
      errorMessage =
        "날짜 정보에 문제가 있습니다. Step 1에서 학습 기간을 확인해주세요.";
    } else if (response.error.includes("제외일")) {
      errorMessage =
        "제외일 정보에 문제가 있습니다. Step 2에서 제외일을 확인해주세요.";
    } else {
      errorMessage = response.error;
    }
  }

  setError(errorMessage);
}
```

**파일**: `app/(student)/actions/calculateScheduleAvailability.ts`

더 구체적인 에러 메시지 반환:

```typescript
// 현재
if (blocks.length === 0) {
  return {
    success: false,
    error:
      "선택한 블록 세트에 블록이 없습니다. Step 1에서 블록을 추가해주세요.",
    data: null,
  };
}

// 개선: 블록 세트 ID 포함
if (blocks.length === 0) {
  return {
    success: false,
    error: `블록 세트(ID: ${params.blockSetId})에 블록이 없습니다. Step 1에서 블록을 추가해주세요.`,
    data: null,
  };
}
```

### 방안 4: 초기 데이터 검증 및 디버깅 로그

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

초기 데이터를 설정할 때 검증 및 로깅 추가:

```typescript
// 템플릿 데이터를 initialData로 변환
const templateData = template.template_data as any;

// 개발 환경에서 디버깅 로그
if (process.env.NODE_ENV === "development") {
  console.log("[CampParticipationPage] 템플릿 데이터:", {
    period_start: templateData.period_start,
    period_end: templateData.period_end,
    block_set_id: templateData.block_set_id,
    scheduler_type: templateData.scheduler_type,
    exclusions: templateData.exclusions?.length || 0,
    academy_schedules: templateData.academy_schedules?.length || 0,
  });
}

// 필수 필드 검증
const requiredFields = [
  "period_start",
  "period_end",
  "block_set_id",
  "scheduler_type",
];
const missingFields = requiredFields.filter((field) => !templateData[field]);

if (missingFields.length > 0) {
  console.error("[CampParticipationPage] 필수 필드 누락:", missingFields);
  // 사용자에게 에러 표시 또는 기본값 설정
}
```

### 방안 5: 제외일 중복 방지

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

템플릿 제외일과 학생 제외일을 병합할 때 중복 제거:

```typescript
// 템플릿 제외일
const templateExclusions = (templateData.exclusions || []).map(
  (exclusion: any) => ({
    ...exclusion,
    source: "template" as const,
    is_locked: true,
  })
);

// 학생이 추가한 제외일 (중복 제거)
const studentExclusions = (wizardData.exclusions || []).filter(
  (e) =>
    e.source !== "template" &&
    !templateExclusions.some((te) => te.exclusion_date === e.exclusion_date)
);

// 최종 제외일 목록
const finalExclusions = [...templateExclusions, ...studentExclusions];
```

### 방안 6: 스케줄 계산 전 사전 검증

**파일**: `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx`

스케줄 계산을 호출하기 전에 필수 데이터 검증:

```typescript
// 스케줄 계산 파라미터 메모이제이션
const scheduleParams = useMemo<ScheduleCalculationParams | null>(
  () => {
    // 필수 필드 검증
    if (
      !data.period_start ||
      !data.period_end ||
      !data.block_set_id ||
      !data.scheduler_type
    ) {
      return null;
    }

    // 날짜 형식 검증
    const startDate = new Date(data.period_start);
    const endDate = new Date(data.period_end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error("[Step2_5SchedulePreview] 날짜 형식 오류:", {
        period_start: data.period_start,
        period_end: data.period_end,
      });
      return null;
    }

    if (startDate > endDate) {
      console.error("[Step2_5SchedulePreview] 날짜 범위 오류:", {
        start: data.period_start,
        end: data.period_end,
      });
      return null;
    }

    // 블록 세트 검증
    if (!selectedBlockSetBlocks || selectedBlockSetBlocks.length === 0) {
      console.error("[Step2_5SchedulePreview] 블록이 없음:", {
        block_set_id: data.block_set_id,
        blockSets: blockSets.length,
      });
      return null;
    }

    // 나머지 로직...
  },
  [
    /* dependencies */
  ]
);
```

## 📝 구현 우선순위

1. **즉시 구현 (High Priority)**

   - 방안 3: 에러 메시지 개선 (구체적인 원인 표시)
   - 방안 4: 초기 데이터 검증 및 디버깅 로그

2. **단기 구현 (Medium Priority)**

   - 방안 1: 템플릿 데이터 검증 강화
   - 방안 6: 스케줄 계산 전 사전 검증

3. **중기 구현 (Low Priority)**
   - 방안 5: 제외일 중복 방지

**✅ 완료된 구현**:

- 방안 2: 블록 세트 존재 여부 확인 (캠프 모드에서 템플릿 블록 세트 조회 로직 수정)

## 🧪 테스트 시나리오

### 시나리오 1: 필수 필드 누락

- 템플릿에 `period_start`가 없는 경우
- 템플릿에 `block_set_id`가 없는 경우
- **예상 결과**: 구체적인 에러 메시지 표시

### 시나리오 2: 블록 세트 문제

- 템플릿의 `block_set_id`가 학생의 블록 세트 목록에 없는 경우
- 블록 세트는 있지만 블록이 없는 경우
- **예상 결과**: 블록 관련 구체적인 에러 메시지 표시

### 시나리오 3: 날짜 형식 문제

- 템플릿의 날짜 형식이 잘못된 경우
- 시작일이 종료일보다 늦은 경우
- **예상 결과**: 날짜 관련 구체적인 에러 메시지 표시

### 시나리오 4: 제외일 중복

- 템플릿 제외일과 학생 제외일이 중복된 경우
- **예상 결과**: 중복 제외일 자동 제거 또는 경고 메시지

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/page.tsx` - 캠프 참여 페이지
- `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx` - Step3 컴포넌트
- `app/(student)/actions/calculateScheduleAvailability.ts` - 스케줄 계산 Server Action
- `lib/scheduler/calculateAvailableDates.ts` - 스케줄 계산 로직
- `lib/errors/planGroupErrors.ts` - 에러 코드 정의
