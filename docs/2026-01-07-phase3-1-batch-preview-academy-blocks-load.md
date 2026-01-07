# Phase 3.1: 배치 미리보기에서 학원 일정 및 블록 정보 로드 구현

## 작업 개요

**작업 일자**: 2026-01-07  
**우선순위**: HIGH  
**상태**: 완료 ✅

## 목표

배치 플랜 미리보기에서 플랜 검증을 위해 필요한 학원 일정과 블록셋 정보를 로드하도록 구현했습니다.

## 문제점

`lib/domains/admin-plan/actions/batchPreviewPlans.ts`의 `validatePlans` 호출 시 학원 일정과 블록셋 정보가 빈 배열로 전달되어 검증이 제대로 이루어지지 않았습니다.

```typescript
// 기존 코드 (414-415줄)
academySchedules: [], // TODO: 학원 일정 로드
blockSets: [], // TODO: 블록 정보 로드
```

## 구현 내용

### 1. 학원 일정 로드 함수 추가

`loadAcademySchedules` 함수를 추가하여 학생의 학원 일정을 조회하고 `AcademyScheduleForPrompt` 타입으로 변환합니다.

```typescript
async function loadAcademySchedules(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId: string
): Promise<AcademyScheduleForPrompt[]> {
  const { data: schedules } = await supabase
    .from("academy_schedules")
    .select("id, day_of_week, start_time, end_time, academy_name, subject, travel_time")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!schedules || schedules.length === 0) {
    return [];
  }

  return schedules.map((s) => ({
    id: s.id,
    dayOfWeek: s.day_of_week,
    startTime: s.start_time ? s.start_time.slice(0, 5) : "00:00", // HH:mm
    endTime: s.end_time ? s.end_time.slice(0, 5) : "00:00",
    academyName: s.academy_name || undefined,
    subject: s.subject || undefined,
    travelTime: s.travel_time ? Number(s.travel_time) : undefined,
  }));
}
```

**주요 특징**:
- 학생 ID와 테넌트 ID로 학원 일정 조회
- 시간 형식을 `HH:mm:ss`에서 `HH:mm`으로 변환
- `travel_time`을 숫자로 변환하여 반환

### 2. 블록셋 정보 로드 함수 추가

`loadBlockSets` 함수를 추가하여 학생의 활성 블록셋 정보를 조회하고 `BlockInfoForPrompt` 타입으로 변환합니다.

```typescript
async function loadBlockSets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<BlockInfoForPrompt[]> {
  // 학생의 활성 블록셋 확인
  const { data: student } = await supabase
    .from("students")
    .select("active_block_set_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student?.active_block_set_id) {
    return [];
  }

  // 활성 블록셋의 블록 스케줄 조회
  const { data: blocks } = await supabase
    .from("student_block_schedule")
    .select("id, day_of_week, start_time, end_time")
    .eq("student_id", studentId)
    .eq("block_set_id", student.active_block_set_id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!blocks || blocks.length === 0) {
    return [];
  }

  return blocks.map((b, index) => ({
    id: b.id,
    blockIndex: index,
    dayOfWeek: b.day_of_week,
    startTime: b.start_time ? b.start_time.slice(0, 5) : "00:00", // HH:mm
    endTime: b.end_time ? b.end_time.slice(0, 5) : "00:00",
    blockName: undefined,
  }));
}
```

**주요 특징**:
- 학생의 활성 블록셋 ID 확인
- 활성 블록셋의 블록 스케줄만 조회
- 시간 형식을 `HH:mm:ss`에서 `HH:mm`으로 변환
- 블록 인덱스를 순차적으로 할당

### 3. 데이터 로드 통합

`generatePreviewForStudent` 함수에서 학원 일정과 블록셋 정보를 병렬로 로드하도록 수정했습니다.

```typescript
// 3. 관련 데이터 로드
const [scores, contents, timeSlots, learningStats, academySchedules, blockSets] =
  await Promise.all([
    loadScores(supabase, studentId),
    loadContents(supabase, contentIds),
    loadTimeSlots(supabase, tenantId),
    loadLearningStats(supabase, studentId),
    loadAcademySchedules(supabase, studentId, tenantId),
    loadBlockSets(supabase, studentId),
  ]);
```

### 4. 검증 함수에 데이터 전달

`validatePlans` 호출 시 로드한 학원 일정과 블록셋 정보를 전달하도록 수정했습니다.

```typescript
// 9. 검증
const validation = validatePlans({
  plans: allPlans,
  academySchedules,
  blockSets,
  excludeDays: settings.excludeDays || [],
  excludeDates: [],
  dailyStudyMinutes: settings.dailyStudyMinutes,
});
```

## 변경된 파일

- `lib/domains/admin-plan/actions/batchPreviewPlans.ts`
  - `loadAcademySchedules` 함수 추가
  - `loadBlockSets` 함수 추가
  - `generatePreviewForStudent` 함수에서 데이터 로드 통합
  - `validatePlans` 호출 시 실제 데이터 전달

## 타입 정의

### AcademyScheduleForPrompt

```typescript
export interface AcademyScheduleForPrompt {
  id: string;
  dayOfWeek: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  academyName?: string;
  subject?: string;
  travelTime?: number;
}
```

### BlockInfoForPrompt

```typescript
export interface BlockInfoForPrompt {
  id: string;
  blockIndex: number;
  dayOfWeek: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  blockName?: string;
}
```

## 검증 기능

이제 `validatePlans` 함수가 다음 검증을 수행할 수 있습니다:

1. **학원 일정 충돌 검증**: 생성된 플랜이 학원 일정과 겹치는지 확인
2. **블록 호환성 검증**: 생성된 플랜이 학생의 블록 시간대와 일치하는지 확인

## 참고

- `lib/domains/plan/llm/actions/generatePlan.ts`의 `loadAcademySchedules`와 `loadBlockSets` 함수를 참고하여 구현
- `lib/domains/plan/llm/validators/planValidator.ts`의 `validatePlans` 함수가 이 데이터를 사용하여 검증 수행

## 다음 단계

- [ ] 실제 데이터로 검증 테스트 수행
- [ ] 학원 일정이 없는 경우의 처리 확인
- [ ] 활성 블록셋이 없는 경우의 처리 확인

---

**작업 완료 일자**: 2026-01-07  
**커밋**: `feat: Phase 3.1 - 배치 미리보기에서 학원 일정 및 블록 정보 로드 구현`

