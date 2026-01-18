# 자동저장 중복 키 오류 수정

## 문제 상황

자동저장 기능이 여러 번 호출되면서 같은 `camp_invitation_id`로 여러 개의 draft를 생성하려고 시도하여 UNIQUE 제약 조건 위반 오류가 발생했습니다.

### 오류 메시지
```
duplicate key value violates unique constraint "plan_groups_camp_invitation_id_key"
```

### 원인 분석

1. `plan_groups` 테이블에 `camp_invitation_id`에 대한 UNIQUE 제약 조건이 있음
2. `handleSaveDraft` 함수에서 `draftGroupId`가 없으면 `savePlanGroupDraftAction`을 호출하여 새로운 draft를 생성
3. 자동저장이 여러 번 호출되면서, 첫 번째 호출에서 `draftGroupId`가 아직 설정되지 않은 상태에서 두 번째 호출이 일어나면, 같은 `camp_invitation_id`로 두 개의 draft를 생성하려고 시도
4. UNIQUE 제약 조건 위반으로 오류 발생

## 해결 방법

`savePlanGroupDraftAction`에서 `camp_invitation_id`가 있을 때 기존 draft를 먼저 확인하고, 있으면 업데이트하고 없으면 생성하도록 수정했습니다.

### 수정 내용

**파일**: `app/(student)/actions/plan-groups/create.ts`

`_savePlanGroupDraft` 함수에 다음 로직을 추가:

```typescript
// camp_invitation_id가 있는 경우, 기존 draft를 먼저 확인
// 자동저장 시 중복 생성 방지
if (data.camp_invitation_id) {
  const supabase = await createSupabaseServerClient();
  const { data: existingGroup, error: checkError } = await supabase
    .from("plan_groups")
    .select("id, status")
    .eq("camp_invitation_id", data.camp_invitation_id)
    .eq("student_id", user.userId)
    .eq("status", "draft")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116은 "multiple rows" 에러인데, 이는 이미 처리됨 (limit(1) 사용)
    console.error("[savePlanGroupDraft] 기존 플랜 그룹 확인 중 에러:", checkError);
    // 에러가 있어도 계속 진행 (새로 생성 시도)
  }

  // 기존 draft가 있으면 업데이트
  if (existingGroup && existingGroup.status === "draft") {
    const { updatePlanGroupDraftAction } = await import("./update");
    await updatePlanGroupDraftAction(existingGroup.id, data);
    revalidatePath("/plan");
    return { groupId: existingGroup.id };
  }
}
```

## 효과

1. 자동저장이 여러 번 호출되어도 기존 draft를 찾아서 업데이트하므로 중복 생성 방지
2. UNIQUE 제약 조건 위반 오류 해결
3. 사용자 경험 개선 (오류 없이 자동저장 동작)

## 테스트 시나리오

1. 캠프 모드에서 플랜 그룹 생성 시 자동저장이 여러 번 호출되어도 오류 없이 동작하는지 확인
2. 기존 draft가 있을 때 자동저장이 올바르게 업데이트하는지 확인
3. 새로운 draft 생성 시 정상적으로 생성되는지 확인

## 관련 파일

- `app/(student)/actions/plan-groups/create.ts` - 수정된 파일
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 자동저장 호출 로직
- `supabase/migrations/20250203000001_add_camp_invitation_unique_constraint.sql` - UNIQUE 제약 조건 정의

