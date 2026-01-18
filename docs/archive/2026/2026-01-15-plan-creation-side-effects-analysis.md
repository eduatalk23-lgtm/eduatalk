# 플랜 생성 관련 사이드 이펙트 현황 분석

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: ✅ 분석 완료

---

## 📋 목차

1. [개요](#개요)
2. [사이드 이펙트 분류](#사이드-이펙트-분류)
3. [데이터베이스 변경](#데이터베이스-변경)
4. [캐시 무효화](#캐시-무효화)
5. [이벤트 로깅](#이벤트-로깅)
6. [알림 발송](#알림-발송)
7. [React Query 캐시 무효화](#react-query-캐시-무효화)
8. [게이미피케이션 업데이트](#게이미피케이션-업데이트)
9. [리얼타임 업데이트](#리얼타임-업데이트)
10. [플랜 생성 경로별 사이드 이펙트](#플랜-생성-경로별-사이드-이펙트)
11. [문제점 및 개선 제안](#문제점-및-개선-제안)

---

## 개요

### 목적

플랜 생성 시 발생하는 모든 사이드 이펙트를 체계적으로 분석하고 문서화하여, 시스템의 동작을 명확히 이해하고 잠재적인 문제점을 파악합니다.

### 분석 범위

- **플랜 생성 경로**: 통합 플랜 생성, 위저드 기반 생성, 빠른 생성, AI 생성 등
- **사이드 이펙트 유형**: 데이터베이스 변경, 캐시 무효화, 이벤트 로깅, 알림 발송 등
- **영향 범위**: 학생, 관리자, 학부모 등 다양한 사용자 그룹

### 핵심 발견 사항

1. **다양한 플랜 생성 경로**: 10개 이상의 서로 다른 플랜 생성 함수가 존재
2. **일관성 없는 캐시 무효화**: 경로별로 다른 캐시 무효화 패턴
3. **이벤트 로깅 누락**: 일부 플랜 생성 경로에서 이벤트 로깅이 누락됨
4. **알림 발송 제한**: 캠프 모드에서만 알림 발송이 구현됨

---

## 사이드 이펙트 분류

### 1. 데이터베이스 변경

플랜 생성 시 다음 테이블들이 변경됩니다:

| 테이블 | 변경 유형 | 설명 |
|--------|----------|------|
| `student_plan` | INSERT | 플랜 레코드 생성 |
| `plan_groups` | INSERT/UPDATE | 플랜 그룹 생성 또는 상태 업데이트 |
| `plan_contents` | INSERT | 플랜 그룹에 연결된 콘텐츠 정보 |
| `plan_exclusions` | INSERT | 제외일 정보 |
| `academy_schedules` | INSERT | 학원 일정 정보 |
| `flexible_contents` | INSERT | 자유 학습 콘텐츠 (조건부) |
| `plan_events` | INSERT | 플랜 생성 이벤트 로깅 |

### 2. 캐시 무효화

Next.js의 `revalidatePath`를 통해 다음 경로들이 무효화됩니다:

| 경로 | 설명 | 사용 빈도 |
|------|------|----------|
| `/plan` | 플랜 목록 페이지 | 높음 |
| `/today` | 오늘의 학습 페이지 | 높음 |
| `/plan/calendar` | 플랜 캘린더 페이지 | 중간 |
| `/admin/students/{studentId}/plans` | 관리자 플랜 관리 페이지 | 높음 |
| `/plan/group/{groupId}` | 플랜 그룹 상세 페이지 | 중간 |

### 3. 이벤트 로깅

`plan_events` 테이블에 다음 이벤트 타입들이 기록됩니다:

| 이벤트 타입 | 설명 | 발생 조건 |
|------------|------|----------|
| `unified_plan_created` | 통합 플랜 생성 | `createUnifiedPlan` |
| `unified_adhoc_created` | 통합 단발성 플랜 생성 | `createUnifiedPlan` (isAdhoc=true) |
| `plan_created` | 일반 플랜 생성 | `logPlanCreated` |
| `plan_completed` | 플랜 완료 | `logPlanCompleted` |
| `plan_deleted` | 플랜 삭제 | `logPlanDeleted` |
| `container_moved` | 컨테이너 이동 | `logContainerMoved` |
| `volume_adjusted` | 볼륨 조정 | `logVolumeAdjusted` |
| `volume_redistributed` | 볼륨 재분배 | `logVolumeRedistributed` |
| `plan_carryover` | 플랜 이월 | `logPlanCarryover` |

### 4. 알림 발송

캠프 모드에서만 알림이 발송됩니다:

| 알림 타입 | 수신자 | 발생 조건 |
|----------|--------|----------|
| 플랜 생성 알림 | 학생 | 캠프 플랜 생성 완료 시 |
| 플랜 생성 알림 | 학부모 | 캠프 플랜 생성 완료 시 (비동기) |

---

## 데이터베이스 변경

### 1. 플랜 생성 (`student_plan` 테이블)

**위치**: `lib/domains/admin-plan/actions/unifiedPlanCreate.ts`

```typescript
const { data: createdPlan, error: insertError } = await supabase
  .from("student_plan")
  .insert(planData)
  .select("id, plan_date")
  .single();
```

**주요 필드**:
- `student_id`, `tenant_id`, `plan_group_id`
- `content_type`, `content_id`, `flexible_content_id`
- `plan_date`, `block_index`, `order_index`
- `status`, `is_active`, `is_adhoc`
- `created_by`, `created_at`, `updated_at`

### 2. 플랜 그룹 생성/업데이트 (`plan_groups` 테이블)

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

```typescript
const atomicResult = await createPlanGroupAtomic(
  tenantContext.tenantId,
  studentId,
  planGroupData,
  processedContents,
  exclusionsData,
  schedulesData
);
```

**RPC 함수**: `create_plan_group_atomic`
- 원자적 트랜잭션으로 다음을 한 번에 처리:
  - `plan_groups` INSERT
  - `plan_contents` INSERT
  - `plan_exclusions` INSERT
  - `academy_schedules` INSERT

### 3. 플랜 그룹 상태 업데이트

**위치**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

```typescript
if ((group.status as PlanStatus) === "draft") {
  await persistence.updatePlanGroupStatus("saved", insertResult.insertedIds);
}
```

**상태 전이**:
- `draft` → `saved` (플랜 생성 시)
- `saved` → `active` (플랜 생성 완료 시)

### 4. 기존 플랜 삭제 (재생성 시)

**위치**: `lib/plan/shared/PlanPersistenceService.ts`

```typescript
if (options?.deleteExisting) {
  const deleteResult = await this.deleteExistingPlans(planGroupId, context);
}
```

**조건**: `deleteExisting` 옵션이 `true`인 경우

---

## 캐시 무효화

### 1. 통합 플랜 생성 (`createUnifiedPlan`)

**위치**: `lib/domains/admin-plan/actions/unifiedPlanCreate.ts`

```typescript
revalidatePath(`/admin/students/${input.studentId}/plans`);
revalidatePath("/today");
revalidatePath("/plan");
```

**무효화 경로**: 3개

### 2. 플랜 그룹 생성 (`createPlanGroup`)

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

```typescript
revalidatePath("/plan");
```

**무효화 경로**: 1개

### 3. 빠른 플랜 생성 (`createQuickPlan`)

**위치**: `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`

```typescript
revalidatePath("/today");
revalidatePath("/plan");
revalidatePath("/plan/calendar");
```

**무효화 경로**: 3개

### 4. AI 플랜 생성 (`generatePlanWithAI`)

**위치**: `lib/domains/plan/llm/actions/generatePlan.ts`

```typescript
revalidatePath("/plan");
revalidatePath("/plan/calendar");
revalidatePath("/today");
```

**무효화 경로**: 3개

### 5. 스케줄러 기반 플랜 생성 (`createPlanFromContentWithScheduler`)

**위치**: `lib/domains/admin-plan/actions/createPlanFromContent.ts`

```typescript
revalidatePath(`/admin/students/${input.studentId}/plans`);
revalidatePath('/today');
revalidatePath('/plan');
```

**무효화 경로**: 3개

### 캐시 무효화 패턴 분석

| 함수 | 무효화 경로 수 | 경로 목록 |
|------|---------------|----------|
| `createUnifiedPlan` | 3 | `/admin/students/{id}/plans`, `/today`, `/plan` |
| `createPlanGroup` | 1 | `/plan` |
| `createQuickPlan` | 3 | `/today`, `/plan`, `/plan/calendar` |
| `generatePlanWithAI` | 3 | `/plan`, `/plan/calendar`, `/today` |
| `createPlanFromContentWithScheduler` | 3 | `/admin/students/{id}/plans`, `/today`, `/plan` |
| `generatePlansWithServices` | 0 | 없음 (서버 액션 내부 함수) |

**문제점**:
- `createPlanGroup`은 1개 경로만 무효화 (다른 함수들과 불일치)
- `generatePlansWithServices`는 캐시 무효화 없음 (호출하는 함수에서 처리해야 함)

---

## 이벤트 로깅

### 1. 통합 플랜 생성 이벤트

**위치**: `lib/domains/admin-plan/actions/unifiedPlanCreate.ts`

```typescript
await createPlanEvent({
  tenant_id: input.tenantId,
  student_id: input.studentId,
  student_plan_id: createdPlan.id,
  plan_group_id: planGroupResult.planGroupId,
  event_type: input.isAdhoc ? "unified_adhoc_created" : "unified_plan_created",
  event_category: "plan_item",
  payload: {
    title: input.title,
    planDate: input.planDate,
    isAdhoc: input.isAdhoc,
    isFreeLearning: input.isFreeLearning,
    contentType: effectiveContentType,
  },
  new_state: planData as unknown as Record<string, unknown>,
  actor_id: userId,
  actor_type: "admin",
});
```

**이벤트 타입**:
- `unified_plan_created`: 일반 플랜
- `unified_adhoc_created`: 단발성 플랜

### 2. 플랜 그룹 생성 이벤트

**현재 상태**: ❌ 이벤트 로깅 없음

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

**문제점**: 플랜 그룹 생성 시 이벤트가 기록되지 않음

### 3. 플랜 생성 (위저드) 이벤트

**현재 상태**: ❌ 이벤트 로깅 없음

**위치**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

**문제점**: 위저드 기반 플랜 생성 시 이벤트가 기록되지 않음

### 4. 빠른 플랜 생성 이벤트

**현재 상태**: ❌ 이벤트 로깅 없음

**위치**: `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`

**문제점**: 빠른 플랜 생성 시 이벤트가 기록되지 않음

### 이벤트 로깅 현황 요약

| 플랜 생성 경로 | 이벤트 로깅 | 이벤트 타입 |
|---------------|------------|------------|
| `createUnifiedPlan` | ✅ 있음 | `unified_plan_created`, `unified_adhoc_created` |
| `createPlanGroup` | ❌ 없음 | - |
| `generatePlansWithServices` | ❌ 없음 | - |
| `createQuickPlan` | ❌ 없음 | - |
| `generatePlanWithAI` | ❌ 없음 | - |
| `createPlanFromContentWithScheduler` | ❌ 없음 | - |

**문제점**: 대부분의 플랜 생성 경로에서 이벤트 로깅이 누락됨

---

## 알림 발송

### 1. 캠프 플랜 생성 알림

**위치**: `lib/domains/camp/actions/progress/wizard.ts`

```typescript
// 플랜 생성 성공 시 학생에게 알림 발송
if (result.group.camp_template_id && result.group.student_id) {
  await sendPlanCreatedNotificationToStudent({
    studentId: result.group.student_id,
    studentName: studentData.data.name || "학생",
    templateId: result.group.camp_template_id,
    templateName: templateData.data.name,
    groupId,
    tenantId,
  });

  // 학부모에게도 플랜 생성 알림 발송 (비동기)
  sendPlanCreatedNotificationToParents({
    studentId: result.group.student_id,
    studentName: studentData.data.name || "학생",
    templateId: result.group.camp_template_id,
    templateName: templateData.data.name,
    groupId,
    tenantId,
  }).catch((err) => {
    logActionError(/* ... */);
  });
}
```

**알림 타입**:
- 학생 알림: 동기 처리
- 학부모 알림: 비동기 처리 (실패해도 플랜 생성에 영향 없음)

### 2. 일반 플랜 생성 알림

**현재 상태**: ❌ 알림 발송 없음

**문제점**: 일반 플랜 생성 시 알림이 발송되지 않음

---

## React Query 캐시 무효화

### 1. 위저드 기반 플랜 생성

**위치**: `app/(student)/plan/new-group/_components/_features/scheduling/Step7ScheduleResult.tsx`

```typescript
onSuccess: async () => {
  // 플랜 생성 후 DB 동기화를 위한 짧은 지연
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // 플랜 생성 후 관련 쿼리 무효화 및 즉시 refetch
  await queryClient.invalidateQueries({ queryKey: ["plansExist", groupId] });
  await queryClient.invalidateQueries({ queryKey: ["planSchedule", groupId] });
  await queryClient.invalidateQueries({ queryKey: ["contentScheduleOverview", groupId] });
  
  // 즉시 refetch하여 최신 데이터 표시
  await queryClient.refetchQueries({
    queryKey: ["plansExist", groupId],
    exact: true
  });
  await queryClient.refetchQueries({ queryKey: ["planSchedule", groupId] });
}
```

**무효화 쿼리**:
- `["plansExist", groupId]`
- `["planSchedule", groupId]`
- `["contentScheduleOverview", groupId]`

**특징**: DB 동기화를 위한 500ms 지연 후 무효화

### 2. 다른 플랜 생성 경로

**현재 상태**: ❌ React Query 캐시 무효화 없음

**문제점**: 대부분의 플랜 생성 경로에서 React Query 캐시 무효화가 누락됨

---

## 게이미피케이션 업데이트

### 플랜 완료 시 게이미피케이션 업데이트

**위치**: `lib/domains/today/actions/timer.ts`

```typescript
// 게이미피케이션 업데이트 (비동기로 처리, 실패해도 플랜 완료에 영향 없음)
const studyDurationMinutes = Math.floor(finalDuration / 60);
try {
  const gamificationResult = await updateGamificationOnPlanComplete({
    studentId: user.userId,
    tenantId: tenantId || "",
    eventType: "plan_completed",
    studyDurationMinutes,
    completedAt: new Date(),
    planId,
  });
} catch (gamificationError) {
  // 게이미피케이션 오류는 플랜 완료에 영향을 주지 않음
  timerLogger.warn("게이미피케이션 업데이트 실패", { /* ... */ });
}
```

**특징**:
- 비동기 처리
- 실패해도 플랜 완료에 영향 없음
- 플랜 생성 시에는 게이미피케이션 업데이트 없음

---

## 리얼타임 업데이트

### 1. 플랜 리얼타임 업데이트

**위치**: `lib/realtime/usePlanRealtimeUpdates.ts`

```typescript
export function usePlanRealtimeUpdates({
  planDate,
  userId,
  enabled = true,
}: UsePlanRealtimeUpdatesOptions) {
  // Supabase Realtime 구독
  // student_plan 테이블 변경 감지
}
```

**구독 대상**: `student_plan` 테이블

### 2. 플랜 그룹 리얼타임 업데이트

**위치**: `lib/realtime/usePlanGroupRealtime.ts`

```typescript
export function usePlanGroupRealtime({
  studentId,
  enabled = true,
}: UsePlanGroupRealtimeOptions) {
  // Supabase Realtime 구독
  // plan_groups 테이블 변경 감지
}
```

**구독 대상**: `plan_groups` 테이블

**특징**: 클라이언트 사이드에서 자동으로 리얼타임 업데이트 처리

---

## 플랜 생성 경로별 사이드 이펙트

### 1. 통합 플랜 생성 (`createUnifiedPlan`)

**위치**: `lib/domains/admin-plan/actions/unifiedPlanCreate.ts`

| 사이드 이펙트 | 상태 | 비고 |
|--------------|------|------|
| DB: `student_plan` INSERT | ✅ | 단일 플랜 생성 |
| DB: `plan_groups` INSERT/UPDATE | ✅ | 플랜 그룹 확보 |
| DB: `flexible_contents` INSERT | ✅ | 자유 학습인 경우 |
| DB: `plan_events` INSERT | ✅ | 이벤트 로깅 |
| 캐시 무효화 | ✅ | 3개 경로 |
| React Query 무효화 | ❌ | 없음 |
| 알림 발송 | ❌ | 없음 |

### 2. 플랜 그룹 생성 (`createPlanGroup`)

**위치**: `lib/domains/plan/actions/plan-groups/create.ts`

| 사이드 이펙트 | 상태 | 비고 |
|--------------|------|------|
| DB: `plan_groups` INSERT | ✅ | RPC 함수 사용 |
| DB: `plan_contents` INSERT | ✅ | RPC 함수 사용 |
| DB: `plan_exclusions` INSERT | ✅ | RPC 함수 사용 |
| DB: `academy_schedules` INSERT | ✅ | RPC 함수 사용 |
| DB: `plan_events` INSERT | ❌ | 없음 |
| 캐시 무효화 | ✅ | 1개 경로만 |
| React Query 무효화 | ❌ | 없음 |
| 알림 발송 | ❌ | 없음 |

### 3. 플랜 생성 (위저드) (`generatePlansWithServices`)

**위치**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

| 사이드 이펙트 | 상태 | 비고 |
|--------------|------|------|
| DB: `student_plan` INSERT | ✅ | 여러 플랜 일괄 생성 |
| DB: `student_plan` DELETE | ✅ | 기존 플랜 삭제 (옵션) |
| DB: `plan_groups` UPDATE | ✅ | 상태 업데이트 (draft → saved) |
| DB: `plan_events` INSERT | ❌ | 없음 |
| 캐시 무효화 | ❌ | 없음 (호출하는 함수에서 처리) |
| React Query 무효화 | ❌ | 없음 |
| 알림 발송 | ❌ | 없음 |

### 4. 빠른 플랜 생성 (`createQuickPlan`)

**위치**: `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`

| 사이드 이펙트 | 상태 | 비고 |
|--------------|------|------|
| DB: `student_plan` INSERT | ✅ | 단일 플랜 생성 |
| DB: `plan_groups` INSERT | ✅ | 플랜 그룹 생성 (필요 시) |
| DB: `flexible_contents` INSERT | ✅ | 자유 학습인 경우 |
| DB: `plan_events` INSERT | ❌ | 없음 |
| 캐시 무효화 | ✅ | 3개 경로 |
| React Query 무효화 | ❌ | 없음 |
| 알림 발송 | ❌ | 없음 |

### 5. AI 플랜 생성 (`generatePlanWithAI`)

**위치**: `lib/domains/plan/llm/actions/generatePlan.ts`

| 사이드 이펙트 | 상태 | 비고 |
|--------------|------|------|
| DB: `student_plan` INSERT | ✅ | 여러 플랜 일괄 생성 |
| DB: `plan_groups` INSERT | ✅ | 플랜 그룹 생성 (필요 시) |
| DB: `plan_events` INSERT | ❌ | 없음 |
| 캐시 무효화 | ✅ | 3개 경로 |
| React Query 무효화 | ❌ | 없음 |
| 알림 발송 | ❌ | 없음 |

### 6. 캠프 플랜 생성 (`continueCampStepsForAdmin`)

**위치**: `lib/domains/camp/actions/progress/wizard.ts`

| 사이드 이펙트 | 상태 | 비고 |
|--------------|------|------|
| DB: `student_plan` INSERT | ✅ | 여러 플랜 일괄 생성 |
| DB: `plan_groups` INSERT/UPDATE | ✅ | 플랜 그룹 생성/업데이트 |
| DB: `plan_events` INSERT | ❌ | 없음 |
| 캐시 무효화 | ✅ | 여러 경로 |
| React Query 무효화 | ❌ | 없음 |
| 알림 발송 | ✅ | 학생 및 학부모 |

---

## 문제점 및 개선 제안

### 1. 이벤트 로깅 누락

**문제점**:
- 대부분의 플랜 생성 경로에서 이벤트 로깅이 누락됨
- 감사 추적 및 분석이 어려움

**개선 제안**:
1. 모든 플랜 생성 함수에 이벤트 로깅 추가
2. 공통 헬퍼 함수 생성하여 일관성 유지
3. 이벤트 타입 표준화

**예시**:
```typescript
// 공통 헬퍼 함수
async function logPlanCreationEvent(
  planId: string,
  planGroupId: string,
  studentId: string,
  tenantId: string,
  eventType: string,
  metadata: Record<string, unknown>
) {
  await createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: planId,
    plan_group_id: planGroupId,
    event_type: eventType,
    event_category: "plan_item",
    payload: metadata,
    actor_id: userId,
    actor_type: "admin",
  });
}
```

### 2. 캐시 무효화 불일치

**문제점**:
- 플랜 생성 경로별로 캐시 무효화 패턴이 다름
- `createPlanGroup`은 1개 경로만 무효화
- `generatePlansWithServices`는 캐시 무효화 없음

**개선 제안**:
1. 표준 캐시 무효화 함수 생성
2. 모든 플랜 생성 함수에서 동일한 패턴 적용

**예시**:
```typescript
// 표준 캐시 무효화 함수
async function revalidatePlanPaths(studentId?: string) {
  revalidatePath("/plan");
  revalidatePath("/today");
  revalidatePath("/plan/calendar");
  
  if (studentId) {
    revalidatePath(`/admin/students/${studentId}/plans`);
  }
}
```

### 3. React Query 캐시 무효화 누락

**문제점**:
- 대부분의 플랜 생성 경로에서 React Query 캐시 무효화가 누락됨
- 클라이언트에서 최신 데이터를 보기 어려움

**개선 제안**:
1. 서버 액션에서 React Query 무효화 힌트 반환
2. 클라이언트에서 자동으로 무효화 처리

**예시**:
```typescript
// 서버 액션 반환값에 무효화 힌트 포함
return {
  success: true,
  planId: createdPlan.id,
  invalidateQueries: [
    ["plansExist", groupId],
    ["planSchedule", groupId],
  ],
};
```

### 4. 알림 발송 제한

**문제점**:
- 캠프 모드에서만 알림 발송
- 일반 플랜 생성 시 알림 없음

**개선 제안**:
1. 알림 설정 기반으로 알림 발송 여부 결정
2. 모든 플랜 생성 경로에서 알림 발송 지원

### 5. 사이드 이펙트 중앙화

**문제점**:
- 각 플랜 생성 함수에서 사이드 이펙트를 개별적으로 처리
- 일관성 유지 어려움

**개선 제안**:
1. 사이드 이펙트 처리 서비스 생성
2. 모든 플랜 생성 함수에서 공통 서비스 사용

**예시**:
```typescript
// 사이드 이펙트 처리 서비스
class PlanCreationSideEffects {
  async handlePlanCreated(params: {
    planId: string;
    planGroupId: string;
    studentId: string;
    tenantId: string;
    eventType: string;
    metadata: Record<string, unknown>;
  }) {
    // 1. 이벤트 로깅
    await this.logEvent(params);
    
    // 2. 캐시 무효화
    await this.revalidateCache(params.studentId);
    
    // 3. 알림 발송 (설정 기반)
    await this.sendNotification(params);
    
    // 4. React Query 무효화 힌트 반환
    return this.getInvalidationHints(params);
  }
}
```

---

## 참고 문서

- [관리자 영역 학생 대상 플래너 생성 및 플랜 관리 시스템 구조 분석](./2026-01-15-admin-planner-plan-creation-system-analysis.md)
- [관리자 플래너-플랜 관리 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)
- [플랜 생성 시 RLS 정책 위반 문제 해결](./plan-insert-rls-fix.md)

---

**작성 완료**: 2026-01-15  
**버전**: 1.0

