# 캠프 초대 삭제 시 관련 데이터 정리 개선

## 작업 개요

캠프 초대 삭제 시 학생이 작성하던 내용이 완전히 삭제되지 않고, 재 초대 시 이전 작성 내용이 남아있는 문제를 해결했습니다.

## 문제 분석

### 기존 문제점

1. **초대 삭제 시 관련 데이터 삭제 불완전**
   - `deletePlanGroupByInvitationId` 함수가 `camp_invitation_id`로만 플랜 그룹을 조회
   - 초대 삭제 시 `camp_invitation_id`가 NULL로 변경된 플랜 그룹은 조회되지 않음
   - 결과적으로 일부 플랜 그룹이 삭제되지 않고 남아있음

2. **재 초대 시 이전 데이터가 남아있음**
   - 초대 삭제 후 재 초대 시, `camp_invitation_id`가 NULL로 변경된 플랜 그룹이 남아있음
   - `submitCampParticipation`에서 `camp_invitation_id`로만 기존 플랜 그룹을 조회
   - 결과적으로 이전 작성 내용이 남아있는 것으로 보임

### 데이터베이스 제약 조건

- `plan_groups.camp_invitation_id`는 `ON DELETE SET NULL`로 설정되어 있음
- 초대 삭제 시 플랜 그룹의 `camp_invitation_id`만 NULL로 변경되고 플랜 그룹은 유지됨
- 따라서 초대 삭제 시 명시적으로 플랜 그룹을 삭제해야 함

## 해결 방안

### 1. 초대 삭제 시 더 철저한 데이터 정리

`deletePlanGroupByInvitationId` 함수를 개선하여:
- `camp_invitation_id`로 플랜 그룹 조회 및 삭제
- 초대 정보를 조회하여 `camp_template_id`와 `student_id`로도 플랜 그룹 조회 및 삭제
- `camp_invitation_id`가 NULL로 변경된 경우에도 플랜 그룹을 찾아서 삭제

### 2. 재 초대 시 이전 플랜 그룹 삭제

`submitCampParticipation` 함수를 개선하여:
- 재 초대 시 `camp_template_id`와 `student_id`로 이전 플랜 그룹 조회
- 현재 초대와 연결되지 않은 이전 플랜 그룹이 있으면 삭제
- 관련 데이터(student_plan, plan_contents, plan_exclusions)도 함께 삭제

## 수정 내용

### 1. `lib/data/planGroups.ts`

#### 1.1 `deletePlanGroupByInvitationId` 함수 개선

**변경 전**:
- `camp_invitation_id`로만 플랜 그룹 조회

**변경 후**:
- 초대 정보를 먼저 조회하여 `camp_template_id`와 `student_id` 확인
- `camp_invitation_id`로 플랜 그룹 조회
- `camp_template_id`와 `student_id`로도 플랜 그룹 조회 (camp_invitation_id가 NULL인 경우)
- 두 방법 중 하나로 찾은 플랜 그룹을 삭제

**주요 변경 사항**:
```typescript
// 0. 초대 정보 조회 (camp_template_id와 student_id 확인용)
const invitation = await getCampInvitation(invitationId);
const templateId = invitation?.camp_template_id;
const studentId = invitation?.student_id;

// 1. camp_invitation_id로 플랜 그룹 조회
const { data: planGroupByInvitationId } = await supabase
  .from("plan_groups")
  .select("id, student_id")
  .eq("camp_invitation_id", invitationId)
  .is("deleted_at", null)
  .maybeSingle();

// 2. camp_template_id와 student_id로도 플랜 그룹 조회
if (templateId && studentId) {
  const { data: planGroupByTemplate } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("student_id", studentId)
    .eq("plan_type", "camp")
    .is("camp_invitation_id", null) // camp_invitation_id가 NULL인 것만
    .is("deleted_at", null)
    .maybeSingle();
}

// 삭제할 플랜 그룹 결정 (우선순위: camp_invitation_id로 찾은 것)
const planGroup = planGroupByInvitationId || planGroupByTemplateAndStudent;
```

### 2. `app/(student)/actions/campActions.ts`

#### 2.1 `submitCampParticipation` 함수 개선

**변경 전**:
- `camp_invitation_id`로만 기존 플랜 그룹 조회
- 재 초대 시 이전 플랜 그룹이 남아있을 수 있음

**변경 후**:
- 새 플랜 그룹 생성 전에 `camp_template_id`와 `student_id`로 이전 플랜 그룹 조회
- 현재 초대와 연결되지 않은 이전 플랜 그룹이 있으면 삭제
- 관련 데이터(student_plan, plan_contents, plan_exclusions)도 함께 삭제

**주요 변경 사항**:
```typescript
// 재 초대 시 이전 플랜 그룹이 남아있을 수 있으므로 확인 및 삭제
const { data: existingGroupByTemplate } = await supabase
  .from("plan_groups")
  .select("id, status, camp_invitation_id")
  .eq("camp_template_id", invitation.camp_template_id)
  .eq("student_id", user.userId)
  .eq("plan_type", "camp")
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

// 이전 플랜 그룹이 있고, 현재 초대와 연결되지 않은 경우 삭제
if (existingGroupByTemplate && existingGroupByTemplate.camp_invitation_id !== invitationId) {
  // 관련 데이터 삭제
  await supabase.from("student_plan").delete().eq("plan_group_id", existingGroupByTemplate.id);
  await supabase.from("plan_contents").delete().eq("plan_group_id", existingGroupByTemplate.id);
  await supabase.from("plan_exclusions").delete().eq("plan_group_id", existingGroupByTemplate.id);
  await supabase.from("plan_groups").delete().eq("id", existingGroupByTemplate.id);
}
```

## 테스트 시나리오

### 시나리오 1: 초대 삭제 시 관련 데이터 완전 삭제

1. 학생이 캠프 참여 정보를 작성 (플랜 그룹 생성)
2. 관리자가 초대 삭제
3. **예상 결과**: 플랜 그룹 및 관련 데이터(student_plan, plan_contents, plan_exclusions)가 완전히 삭제됨

### 시나리오 2: 재 초대 시 이전 데이터가 남아있지 않음

1. 학생이 캠프 참여 정보를 작성 (플랜 그룹 생성)
2. 관리자가 초대 삭제
3. 관리자가 같은 학생에게 재 초대
4. 학생이 캠프 참여 정보를 다시 작성
5. **예상 결과**: 이전 작성 내용이 남아있지 않고, 새로운 플랜 그룹이 생성됨

## 영향 범위

### 영향받는 기능

- 캠프 초대 삭제 (`deleteCampInvitation`, `deleteCampInvitations`)
- 캠프 참여 정보 제출 (`submitCampParticipation`)

### 영향받지 않는 기능

- 일반 플랜 그룹 생성/삭제
- 캠프 템플릿 삭제 (이미 별도 처리됨)

## 주의사항

1. **academy_schedules는 삭제하지 않음**
   - 캠프 모드에서는 academy_schedules가 plan_group_id 없이 저장됨 (학생별 전역 관리)
   - 초대 취소 시 academy_schedules를 삭제하면 다른 플랜 그룹의 학원 일정까지 삭제될 위험이 있음
   - 따라서 academy_schedules는 삭제하지 않고 유지

2. **재 초대 시 이전 플랜 그룹 삭제**
   - 재 초대 시 이전 플랜 그룹을 삭제하므로, 학생이 이전에 작성한 내용은 복구할 수 없음
   - 이는 의도된 동작이며, 재 초대 시 새로운 작성이 시작되어야 함

## 관련 문서

- [캠프 초대 삭제 시 플랜 그룹 삭제 처리](./camp-invitation-delete-plan-group-handling.md)
- [캠프 템플릿 삭제 시 플랜 그룹 삭제 처리](./camp-template-delete-plan-group-handling.md)

