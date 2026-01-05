# 플랜 생성 시 중요 요소 분석 및 문서화

> 작성일: 2025-02-02  
> 목적: 플랜 생성 프로세스의 핵심 요소들을 체계적으로 분석하고 문서화  
> 상태: 완료

---

## 📋 목차

1. [개요](#개요)
2. [입력 데이터 구조](#입력-데이터-구조)
3. [검증 시스템](#검증-시스템)
4. [생성 프로세스](#생성-프로세스)
5. [스케줄러 알고리즘](#스케줄러-알고리즘)
6. [시간 할당 알고리즘](#시간-할당-알고리즘)
7. [콘텐츠 해석 및 복사](#콘텐츠-해석-및-복사)
8. [데이터 저장 및 트랜잭션](#데이터-저장-및-트랜잭션)
9. [에러 처리 및 복구](#에러-처리-및-복구)
10. [성능 최적화](#성능-최적화)

---

## 개요

### 플랜 생성의 핵심 흐름

```
사용자 입력 (위저드)
    ↓
데이터 검증 (PlanValidator)
    ↓
플랜 그룹 생성 (createPlanGroupAtomic)
    ↓
플랜 생성 오케스트레이션 (PlanGenerationOrchestrator)
    ├── 콘텐츠 해석 (ContentResolutionService)
    ├── 스케줄 생성 (ScheduleGenerationService)
    ├── 시간 할당 (TimeAllocationService)
    └── 플랜 저장 (PlanPersistenceService)
    ↓
최종 플랜 데이터 (student_plan 테이블)
```

### 주요 구성 요소

| 구성 요소 | 역할 | 위치 |
|---------|------|------|
| **PlanGroupCreationData** | 입력 데이터 타입 정의 | `lib/types/plan/input.ts` |
| **PlanValidator** | 데이터 검증 로직 | `lib/validation/planValidator.ts` |
| **createPlanGroupAction** | 플랜 그룹 생성 서버 액션 | `lib/domains/plan/actions/plan-groups/create.ts` |
| **PlanGenerationOrchestrator** | 플랜 생성 오케스트레이션 | `lib/plan/services/PlanGenerationOrchestrator.ts` |
| **SchedulerEngine** | 스케줄링 알고리즘 | `lib/plan/scheduler.ts`, `lib/plan/1730TimetableLogic.ts` |
| **TimeAllocationService** | 시간 슬롯 할당 | `lib/plan/services/TimeAllocationService.ts` |
| **ContentResolutionService** | 콘텐츠 해석 및 복사 | `lib/plan/shared/ContentResolutionService.ts` |

---

## 입력 데이터 구조

### PlanGroupCreationData 타입

```typescript
type PlanGroupCreationData = {
  // Step 1: 기본 정보
  name?: string | null;                    // 플랜 이름
  plan_purpose: PlanPurpose;               // 플랜 목적 ("내신대비" | "모의고사(수능)")
  scheduler_type: SchedulerType;           // 스케줄러 타입 ("1730_timetable" | "")
  scheduler_options?: SchedulerOptions;    // 스케줄러 옵션
  period_start: string;                    // 시작일 (YYYY-MM-DD)
  period_end: string;                      // 종료일 (YYYY-MM-DD)
  target_date?: string | null;            // 목표일 (D-day)
  block_set_id?: string | null;            // 블록 세트 ID
  
  // Step 2: 시간 설정
  exclusions: PlanExclusionInput[];        // 제외일 목록
  academy_schedules: AcademyScheduleInput[]; // 학원 일정
  time_settings?: TimeSettings;            // 시간 설정
  study_review_cycle?: StudyReviewCycle;    // 학습일/복습일 주기
  non_study_time_blocks?: NonStudyTimeBlock[]; // 학습 시간 제외 항목
  daily_schedule?: DailyScheduleInfo[];     // 일별 스케줄 정보
  
  // Step 3: 콘텐츠 선택
  contents: PlanContentInput[];            // 플랜 콘텐츠 목록
  
  // 1730 Timetable 추가 필드
  student_level?: StudentLevel;            // 학생 수준 ("high" | "medium" | "low")
  subject_allocations?: SubjectAllocation[]; // 전략과목/취약과목 배정
  subject_constraints?: SubjectConstraints;  // 교과 제약 조건
  additional_period_reallocation?: AdditionalPeriodReallocation; // 추가 기간 재배치
  
  // 캠프 관련
  plan_type?: PlanType;                    // 플랜 타입 ("camp" | null)
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  
  // 슬롯 모드
  use_slot_mode?: boolean;                 // 슬롯 모드 사용 여부
  content_slots?: ContentSlot[] | null;     // 콘텐츠 슬롯 배열
};
```

### 필수 필드 vs 선택 필드

#### 필수 필드 (검증 시 오류 발생)

- `name`: 플랜 이름 (빈 문자열 불가)
- `period_start`, `period_end`: 기간 (시작일 < 종료일)
- `contents`: 최소 1개 이상 (최대 9개)
- `academy_schedules`: 시간 형식 검증 (HH:MM, 시작 < 종료)
- `exclusions`: 기간 내 날짜만 허용

#### 선택 필드 (기본값 또는 null 허용)

- `plan_purpose`: null 허용
- `scheduler_type`: 빈 문자열 허용 (기본 스케줄러 사용)
- `block_set_id`: null 허용
- `target_date`: null 허용
- `time_settings`: 선택사항
- `student_level`: 1730_timetable에서만 필수

### 데이터 변환 및 병합

#### scheduler_options 통합

```typescript
// time_settings와 study_review_cycle을 scheduler_options에 병합
const mergedSchedulerOptions = buildSchedulerOptions({
  scheduler_options: data.scheduler_options,
  time_settings: data.time_settings,
  study_review_cycle: data.study_review_cycle,
});
```

**병합 규칙**:
- `time_settings`의 필드들이 `scheduler_options`에 병합됨
- `study_review_cycle`의 필드들이 `scheduler_options`에 병합됨
- 기존 `scheduler_options`의 필드는 보호됨 (덮어쓰기 방지)

#### 슬롯 모드 → subject_allocations 자동 생성

```typescript
// Dual Write: 슬롯 모드일 때 content_slots에서 subject_allocations 자동 생성
if (data.use_slot_mode && data.content_slots && data.content_slots.length > 0) {
  const generatedAllocations = buildAllocationFromSlots(data.content_slots);
  if (generatedAllocations.length > 0) {
    mergedSchedulerOptions.subject_allocations = generatedAllocations;
  }
}
```

---

## 검증 시스템

### PlanValidator 클래스

**위치**: `lib/validation/planValidator.ts`

#### 검증 단계

```typescript
static validateCreation(
  data: PlanGroupCreationData,
  options?: { skipContentValidation?: boolean }
): ValidationResult
```

**검증 순서**:

1. **기간 검증** (`validatePeriod`)
   - 시작일 < 종료일
   - 최소 1일 이상
   - 최대 365일 (경고)
   - 과거 날짜 경고

2. **제외일 검증** (`validateExclusions`)
   - 제외일이 기간 내에 있는지 확인
   - 제외일 비율 검증 (50% 초과 경고, 80% 초과 오류)

3. **콘텐츠 검증** (`validateContents`)
   - 최소 1개 이상 (최대 9개)
   - 범위 검증 (start_range < end_range, 0 이상)
   - 중복 콘텐츠 경고
   - 6개 초과 시 경고

4. **학원 일정 검증** (`validateAcademySchedules`)
   - 요일 검증 (0-6)
   - 시간 형식 검증 (HH:MM)
   - 시작 시간 < 종료 시간
   - 같은 요일 시간 겹침 검증

5. **목적과 스케줄러 조합 검증** (`validatePurposeAndScheduler`)
   - 내신대비 + 1730_timetable 조합 경고

6. **학습 시간 제외 항목 검증** (`validateNonStudyTimeBlocks`)
   - 시간 형식 검증
   - 시작 < 종료
   - 중복 시간대 검증

### 검증 결과 타입

```typescript
type ValidationResult = {
  valid: boolean;      // 전체 검증 통과 여부
  errors: string[];    // 오류 메시지 배열 (검증 실패)
  warnings: string[];  // 경고 메시지 배열 (검증 통과하지만 주의 필요)
};
```

### 검증 옵션

- `skipContentValidation`: 캠프 모드에서 Step 3 제출 시 콘텐츠 검증 건너뛰기

---

## 생성 프로세스

### 1. 플랜 그룹 생성 (createPlanGroupAction)

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

#### 주요 단계

```typescript
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean;
    studentId?: string | null; // 관리자 모드
  }
): Promise<{ groupId: string }>
```

**프로세스**:

1. **인증 및 권한 확인**
   ```typescript
   const auth = await resolveAuthContext({
     studentId: options?.studentId ?? undefined,
   });
   ```

2. **데이터 검증**
   ```typescript
   const validation = PlanValidator.validateCreation(data, options);
   if (!validation.valid) {
     throw new AppError(validation.errors.join(", "), ...);
   }
   ```

3. **scheduler_options 통합**
   ```typescript
   const mergedSchedulerOptions = buildSchedulerOptions({
     scheduler_options: data.scheduler_options,
     time_settings: data.time_settings,
     study_review_cycle: data.study_review_cycle,
   });
   ```

4. **기존 draft 확인 및 업데이트**
   ```typescript
   const existingGroup = await findExistingDraftPlanGroup(...);
   if (existingGroup) {
     await updatePlanGroupDraftAction(existingGroup.id, data);
     return { groupId: existingGroup.id };
   }
   ```

5. **플랜 기간 중복 검증**
   ```typescript
   const overlapResult = await checkPlanPeriodOverlap(
     studentId,
     data.period_start,
     data.period_end
   );
   if (overlapResult.hasOverlap) {
     throw new AppError("선택한 기간이 기존 플랜과 겹칩니다", ...);
   }
   ```

6. **master_content_id 조회** (배치 조회)
   ```typescript
   // books와 lectures를 병렬로 조회
   const { data: books } = await supabase.from("books").select(...);
   const { data: lectures } = await supabase.from("lectures").select(...);
   ```

7. **원자적 플랜 그룹 생성** (RPC 호출)
   ```typescript
   const atomicResult = await createPlanGroupAtomic(
     tenantId,
     studentId,
     planGroupData,
     processedContents,
     exclusionsData,
     schedulesData
   );
   ```

#### 원자적 생성 (createPlanGroupAtomic)

**RPC 함수**: `create_plan_group_atomic`

**트랜잭션 보장**:
- `plan_groups` 테이블에 플랜 그룹 생성
- `plan_contents` 테이블에 콘텐츠 생성
- `plan_exclusions` 테이블에 제외일 생성
- `academy_schedules` 테이블에 학원 일정 생성

**실패 시 자동 롤백**: 하나라도 실패하면 전체 롤백

### 2. 플랜 생성 오케스트레이션 (PlanGenerationOrchestrator)

**위치**: `lib/plan/services/PlanGenerationOrchestrator.ts`

#### 오케스트레이션 흐름

```typescript
async generate(
  input: PlanGenerationOrchestratorInput
): Promise<ServiceResult<PlanGenerationOrchestratorOutput>>
```

**단계별 프로세스**:

1. **플랜 그룹 및 콘텐츠 조회**
   ```typescript
   const planGroup = await getPlanGroupById(...);
   const contents = await getPlanContents(planGroupId);
   ```

2. **콘텐츠 해석** (ContentResolutionService)
   ```typescript
   const contentResult = await this.contentResolutionService.resolve({
     contents: contents.map(...),
     context: input.context,
   });
   // 결과: contentIdMap, contentDurationMap, contentMetadataMap
   ```

3. **사용 가능한 날짜 계산**
   ```typescript
   const availableDates = calculateAvailableDates(
     planGroup.period_start,
     planGroup.period_end,
     exclusions
   );
   ```

4. **스케줄 생성** (ScheduleGenerationService)
   ```typescript
   const scheduleResult = await this.scheduleGenerationService.generateSchedule({
     contents: scheduleContents,
     availableDates,
     dateMetadataMap,
     options: { ... },
   });
   ```

5. **시간 할당** (TimeAllocationService)
   ```typescript
   const timeResult = await this.timeAllocationService.allocateTime({
     scheduledPlans: scheduleResult.data.scheduledPlans,
     dateTimeRanges: dateTimeRangesMap,
     contentDurationMap,
   });
   ```

6. **미리보기 모드 처리**
   ```typescript
   if (input.options?.previewOnly) {
     return { success: true, data: { previewPlans: ... } };
   }
   ```

7. **플랜 저장** (PlanPersistenceService)
   ```typescript
   const persistResult = await this.planPersistenceService.savePlans({
     plans: enrichedPlans,
     planGroupId: input.planGroupId,
     context: input.context,
     options: { deleteExisting: true },
   });
   ```

---

## 스케줄러 알고리즘

### 스케줄러 타입

#### 1. 1730 Timetable 알고리즘

**위치**: `lib/plan/1730TimetableLogic.ts`, `lib/plan/scheduler.ts`

**핵심 로직**:

```typescript
function generate1730TimetablePlans(
  availableDates: string[],
  contentInfos: ContentInfo[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  schedulerOptions?: SchedulerOptions,
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap,
  contentSubjects?: Map<string, { subject?: string | null }>,
  periodStart?: string
): { plans: ScheduledPlan[]; failureReasons: PlanGenerationFailureReason[] }
```

**알고리즘 단계**:

1. **학습일/복습일 주기 계산**
   ```typescript
   const cycleDays = calculateStudyReviewCycle(
     periodStart,
     periodEnd,
     studyReviewCycle,
     exclusions
   );
   // 결과: CycleDayInfo[] (학습일, 복습일 분류)
   ```

2. **전략과목/취약과목 배정 날짜 계산**
   ```typescript
   const allocationDates = calculateSubjectAllocationDates(
     cycleDays,
     subjectAllocation
   );
   // 전략과목: 주당 N일 배정 (균등 분배)
   // 취약과목: 모든 학습일 배정
   ```

3. **학습 범위 분할**
   ```typescript
   const rangeMap = divideContentRange(
     totalRange,
     allocatedDates,
     contentId,
     distributionMode // "even" | "front_loaded" | "back_loaded"
   );
   // 결과: Map<date, {start, end}>
   ```

4. **소요시간 계산**
   ```typescript
   const duration = calculateDuration(
     range,
     durationInfo,
     studentLevel,    // "high" | "medium" | "low"
     subjectType,     // 과목 타입
     isReview         // 복습 여부 (0.4배 소요시간)
   );
   ```

5. **시간 슬롯 배정** (Bin Packing 유사)
   ```typescript
   const allocatedPlans = assignTimeSlots(
     plans,
     dateTimeSlots,
     blocks
   );
   ```

**특징**:
- 학습일/복습일 주기 기반 배정
- 전략과목과 취약과목 구분 배정
- 학생 수준에 따른 소요시간 조정
- 복습일은 직전 주차 학습 범위 전체 복습 (0.4배 소요시간)

#### 2. 기본 스케줄러

**위치**: `lib/plan/scheduler.ts` - `generateDefaultPlans()`

**알고리즘**:

```typescript
function generateDefaultPlans(
  dates: string[],
  contents: ContentInfo[],
  blocks: BlockInfo[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap
): ScheduledPlan[]
```

**단계**:

1. **콘텐츠별 일일 배정량 계산**
   ```typescript
   const dailyAmount = Math.round(totalAmount / totalStudyDays);
   ```

2. **취약과목 우선 정렬** (Risk Index 기반)
   ```typescript
   const sortedContents = contents.sort((a, b) => {
     const aRisk = riskIndexMap?.get(a.subject)?.riskScore || 0;
     const bRisk = riskIndexMap?.get(b.subject)?.riskScore || 0;
     return bRisk - aRisk; // 위험도 높은 순서대로
   });
   ```

3. **날짜별로 콘텐츠 배정**
   ```typescript
   dates.forEach((date, dateIndex) => {
     sortedContents.forEach((content) => {
       const dailyAmount = contentDailyAmounts.get(content.content_id)[dateIndex];
       // 플랜 생성
     });
   });
   ```

**특징**:
- 단순 범위 분할 (총량 / 학습일 수)
- 취약과목 우선 배정
- 복습일 로직 없음

---

## 시간 할당 알고리즘

### TimeAllocationService

**위치**: `lib/plan/services/TimeAllocationService.ts`

#### Best-Fit Decreasing (BFD) 알고리즘

```typescript
async allocateTime(
  input: TimeAllocationInput
): Promise<ServiceResult<TimeAllocationOutput>>
```

**알고리즘 단계**:

1. **날짜별로 플랜 그룹화**
   ```typescript
   const plansByDate = this.groupPlansByDate(scheduledPlans);
   ```

2. **각 날짜별로 시간 할당**
   ```typescript
   for (const [date, plans] of plansByDate) {
     const timeRanges = dateTimeRanges.get(date) || [];
     const { allocated, unallocated } = this.allocateWithBestFit(
       plans,
       timeRanges,
       date
     );
   }
   ```

3. **Best-Fit Decreasing 배정**
   ```typescript
   // 1. 플랜을 duration 내림차순 정렬 (큰 것부터)
   const sortedPlans = [...plans].sort(
     (a, b) => (b.estimated_duration ?? 60) - (a.estimated_duration ?? 60)
   );
   
   // 2. 각 시간 슬롯을 Bin으로 관리
   const bins: Bin[] = timeRanges.map((slot) => ({
     slot,
     usedMinutes: 0,
     remainingMinutes: slotMinutes,
     plans: [],
   }));
   
   // 3. 각 플랜에 대해 가장 적합한 Bin 찾기
   for (const plan of sortedPlans) {
     let bestBin: Bin | null = null;
     let minRemaining = Infinity;
     
     for (const bin of bins) {
       if (bin.remainingMinutes >= duration &&
           bin.remainingMinutes - duration < minRemaining) {
         bestBin = bin;
         minRemaining = bin.remainingMinutes - duration;
       }
     }
     
     if (bestBin) {
       bestBin.plans.push(plan);
       bestBin.usedMinutes += duration;
       bestBin.remainingMinutes -= duration;
     } else {
       unallocated.push(plan); // 슬롯 부족
     }
   }
   
   // 4. Bin별로 시간 배정
   for (const bin of bins) {
     let currentTime = this.timeToMinutes(bin.slot.start);
     for (const plan of bin.plans) {
       const endTime = currentTime + duration;
       allocated.push({
         ...plan,
         start_time: this.minutesToTime(currentTime),
         end_time: this.minutesToTime(endTime),
       });
       currentTime = endTime;
     }
   }
   ```

**특징**:
- Bin Packing 문제로 모델링
- Best-Fit Decreasing: 큰 플랜부터 배정하여 공간 낭비 최소화
- 슬롯 부족 시 `unallocated`로 분류

---

## 콘텐츠 해석 및 복사

### ContentResolutionService

**위치**: `lib/plan/shared/ContentResolutionService.ts`

#### 해석 프로세스

```typescript
async resolve(
  input: ContentResolutionInput
): Promise<ServiceResult<ContentResolutionOutput>>
```

**단계**:

1. **마스터 콘텐츠 → 학생 콘텐츠 복사**
   ```typescript
   for (const content of contents) {
     if (content.content_type === "book") {
       // Master Book → Student Book 복사
       const studentBook = await copyMasterBook(content.content_id, studentId);
       contentIdMap.set(originalId, studentBook.id);
     } else if (content.content_type === "lecture") {
       // Master Lecture → Student Lecture 복사
       const studentLecture = await copyMasterLecture(content.content_id, studentId);
       contentIdMap.set(originalId, studentLecture.id);
     }
   }
   ```

2. **Duration 정보 조회** (배치 조회)
   ```typescript
   for (const contentId of contentIdMap.values()) {
     const durationInfo = await getContentDuration(contentId);
     contentDurationMap.set(contentId, durationInfo);
   }
   ```

3. **메타데이터 조회**
   ```typescript
   for (const contentId of contentIdMap.values()) {
     const metadata = await getContentMetadata(contentId);
     contentMetadataMap.set(contentId, metadata);
   }
   ```

**Fallback 체인**:
- 학생 콘텐츠가 없으면 마스터 콘텐츠 사용
- Duration 정보가 없으면 기본값 사용 (60분)

---

## 데이터 저장 및 트랜잭션

### PlanPersistenceService

**위치**: `lib/plan/shared/PlanPersistenceService.ts`

#### 저장 프로세스

```typescript
async savePlans(
  input: PlanPersistenceInput
): Promise<ServiceResult<PlanPersistenceOutput>>
```

**단계**:

1. **기존 플랜 삭제** (regenerate 모드)
   ```typescript
   if (input.options.deleteExisting) {
     await supabase
       .from("student_plan")
       .delete()
       .eq("plan_group_id", input.planGroupId);
   }
   ```

2. **플랜 데이터 변환**
   ```typescript
   const planRecords = input.plans.map((plan) => ({
     tenant_id: input.context.tenantId,
     student_id: input.context.studentId,
     plan_group_id: input.planGroupId,
     plan_date: plan.plan_date,
     block_index: plan.block_index,
     content_type: plan.content_type,
     content_id: plan.content_id,
     planned_start_page_or_time: plan.planned_start_page_or_time,
     planned_end_page_or_time: plan.planned_end_page_or_time,
     start_time: plan.start_time,
     end_time: plan.end_time,
     // ... 기타 필드
   }));
   ```

3. **배치 삽입** (청크 단위)
   ```typescript
   const chunkSize = 100;
   for (let i = 0; i < planRecords.length; i += chunkSize) {
     const chunk = planRecords.slice(i, i + chunkSize);
     await supabase.from("student_plan").insert(chunk);
   }
   ```

4. **플랜 그룹 상태 업데이트**
   ```typescript
   await supabase
     .from("plan_groups")
     .update({
       status: "active",
       generated_at: new Date().toISOString(),
     })
     .eq("id", input.planGroupId);
   ```

### 트랜잭션 보장

#### 원자적 플랜 그룹 생성

**RPC 함수**: `create_plan_group_atomic`

**트랜잭션 범위**:
- `plan_groups` INSERT
- `plan_contents` INSERT (배치)
- `plan_exclusions` INSERT (배치)
- `academy_schedules` INSERT (배치)

**실패 시 자동 롤백**: 하나라도 실패하면 전체 롤백

#### 플랜 생성 (비원자적)

**이유**: 플랜 수가 많을 수 있어 트랜잭션 시간이 길어질 수 있음

**대안**:
- 청크 단위 배치 삽입
- 실패 시 부분 롤백 (청크 단위)
- 재시도 로직 포함

---

## 에러 처리 및 복구

### 에러 타입

#### 1. 검증 에러 (ValidationError)

```typescript
throw new AppError(
  validation.errors.join(", "),
  ErrorCode.VALIDATION_ERROR,
  400,
  true
);
```

**처리**:
- 사용자에게 명확한 에러 메시지 표시
- 어떤 필드가 문제인지 명시

#### 2. 데이터베이스 에러 (DatabaseError)

```typescript
if (error.code === "23505") {
  // Unique violation: 동시 요청으로 인한 중복 생성 시도
  const retryExistingGroup = await findExistingDraftPlanGroup(...);
  if (retryExistingGroup) {
    await updatePlanGroupDraftAction(retryExistingGroup.id, data);
    return { groupId: retryExistingGroup.id };
  }
}
```

**처리**:
- Unique violation (23505): 기존 draft 찾아서 업데이트
- Foreign key violation: 참조 무결성 확인
- 기타 에러: 로깅 후 사용자에게 전달

#### 3. 스케줄 생성 실패

```typescript
if (!scheduleResult.success) {
  state.errors.push(scheduleResult.error ?? "스케줄 생성 실패");
  return this.buildErrorResult(state);
}
```

**원인**:
- 사용 가능한 날짜 없음
- 콘텐츠 범위 오류
- 시간 슬롯 부족

**처리**:
- 실패 원인 로깅
- 사용자에게 구체적인 메시지 제공
- 부분 성공 시 가능한 플랜만 저장

### 복구 전략

#### 1. 재시도 로직

```typescript
// 동시 요청으로 인한 중복 생성 시도
if (atomicResult.errorCode === "23505") {
  const retryExistingGroup = await findExistingDraftPlanGroup(...);
  if (retryExistingGroup) {
    await updatePlanGroupDraftAction(retryExistingGroup.id, data);
    return { groupId: retryExistingGroup.id };
  }
}
```

#### 2. 부분 롤백

```typescript
// 플랜 생성 실패 시 플랜 그룹 상태를 draft로 유지
await supabase
  .from("plan_groups")
  .update({ status: "draft" })
  .eq("id", planGroupId);
```

#### 3. 에러 로깅

```typescript
logActionError(
  { domain: "plan", action: "createPlanGroup" },
  error,
  { tenantId, studentId, errorCode: error.code }
);
```

---

## 성능 최적화

### 1. 배치 조회

#### master_content_id 조회

```typescript
// books와 lectures를 병렬로 조회
const [booksResult, lecturesResult] = await Promise.all([
  supabase.from("books").select("id, master_content_id").in("id", bookIds),
  supabase.from("lectures").select("id, master_content_id").in("id", lectureIds),
]);
```

#### Duration 정보 조회

```typescript
// 콘텐츠별 Duration 정보를 배치로 조회
const durationPromises = Array.from(contentIdMap.values()).map(
  async (contentId) => {
    const duration = await getContentDuration(contentId);
    return [contentId, duration];
  }
);
const durationResults = await Promise.all(durationPromises);
```

### 2. 캐싱

#### Episode Map 캐싱

```typescript
// SchedulerEngine.ts: Episode Map 캐싱 (라인 1010-1038)
const episodeMapCache = new Map<string, EpisodeMap>();
```

#### Duration 캐싱

```typescript
// contentDuration.ts: Duration 5분 TTL 캐싱 (라인 50-128)
const durationCache = new Map<string, { data: ContentDurationInfo; expires: number }>();
```

### 3. 병렬 처리

#### 콘텐츠 해석

```typescript
// contentResolver.ts: Promise.all로 병렬 쿼리 (라인 94-107)
const resolutionPromises = contents.map((content) =>
  resolveContent(content, studentId)
);
const results = await Promise.all(resolutionPromises);
```

### 4. 청크 단위 처리

#### 플랜 저장

```typescript
// 대량 플랜을 청크 단위로 나누어 저장
const chunkSize = 100;
for (let i = 0; i < planRecords.length; i += chunkSize) {
  const chunk = planRecords.slice(i, i + chunkSize);
  await supabase.from("student_plan").insert(chunk);
}
```

### 5. 성능 추적

```typescript
// globalPerformanceTracker로 성능 메트릭 수집
const trackingId = globalPerformanceTracker.start(
  "PlanGenerationOrchestrator",
  "generate",
  planGroupId
);

// ... 작업 수행 ...

globalPerformanceTracker.end(trackingId, true);
```

**추적 항목**:
- 각 서비스별 실행 시간
- 느린 작업 자동 감지 (임계값: 1000ms)
- 메모리 사용량 추적

---

## 주요 제약사항 및 제한

### 1. 콘텐츠 개수 제한

- **최소**: 1개
- **최대**: 9개
- **권장**: 6개 이하 (경고 발생)

### 2. 기간 제한

- **최소**: 1일
- **최대**: 365일 (경고 발생)
- **권장**: 90일 이하

### 3. 제외일 비율 제한

- **경고**: 50% 초과
- **오류**: 80% 초과

### 4. 플랜 기간 중복

- 활성/진행 중인 플랜과 기간이 겹치면 오류 발생
- draft 상태 플랜은 중복 허용

### 5. 시간 슬롯 부족

- 시간 슬롯이 부족한 플랜은 `unallocated`로 분류
- 사용자에게 알림 제공

---

## 결론

### 핵심 요소 요약

1. **입력 데이터 구조**: `PlanGroupCreationData` 타입으로 모든 입력 데이터 정의
2. **검증 시스템**: `PlanValidator` 클래스로 단계별 검증 수행
3. **생성 프로세스**: `createPlanGroupAction` → `PlanGenerationOrchestrator` 순서로 실행
4. **스케줄러 알고리즘**: 1730_timetable (고급) vs 기본 스케줄러
5. **시간 할당**: Best-Fit Decreasing 알고리즘으로 효율적 배정
6. **콘텐츠 해석**: 마스터 콘텐츠 → 학생 콘텐츠 복사 및 Duration 조회
7. **데이터 저장**: 원자적 트랜잭션으로 데이터 일관성 보장
8. **에러 처리**: 명확한 에러 메시지 및 복구 전략
9. **성능 최적화**: 배치 조회, 캐싱, 병렬 처리, 청크 단위 처리

### 개선 방향

1. **스케줄러 알고리즘 고도화**: 지능형 스케줄링, 적응형 스케줄링
2. **에러 복구 강화**: 자동 재시도, 부분 롤백 개선
3. **성능 모니터링**: 성능 대시보드, 자동 알림 시스템
4. **사용자 경험 개선**: 실시간 진행 상황 표시, 예측 기반 최적화

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰  
**업데이트 주기**: 분기별 또는 주요 변경 시

