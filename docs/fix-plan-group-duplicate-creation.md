# 플랜 그룹 중복 생성 문제 수정

## 문제 상황

플랜 생성 시 플랜 목록이 2개 생기는 문제가 발생했습니다.

## 원인 분석

1. **`savePlanGroupDraftAction`의 중복 생성 방지 로직 부족**
   - `camp_invitation_id`가 있는 경우에만 기존 draft를 확인
   - 일반 모드에서는 항상 새로 생성하여 중복 발생 가능

2. **`createPlanGroupAction`의 중복 생성 방지 로직 부족**
   - `draftGroupId`가 없으면 무조건 새로 생성
   - 동일한 이름/기간의 draft가 이미 있어도 확인하지 않음

## 수정 내용

### 1. 기존 draft 확인 유틸리티 함수 추가

**파일**: `app/(student)/actions/plan-groups/utils.ts`

```typescript
/**
 * 기존 draft 플랜 그룹 확인
 * 중복 생성 방지를 위해 동일한 조건의 draft가 있는지 확인
 */
export async function findExistingDraftPlanGroup(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  studentId: string,
  name: string | null,
  campInvitationId?: string | null
): Promise<{ id: string; status: string } | null>
```

- 동일한 `student_id`, `name`, `status='draft'`, `deleted_at IS NULL` 조건으로 기존 draft 확인
- `camp_invitation_id`가 있으면 그것도 확인 조건에 포함

### 2. `_savePlanGroupDraft` 함수 개선

**파일**: `app/(student)/actions/plan-groups/create.ts`

- `camp_invitation_id`가 없어도 기존 draft 확인
- 기존 draft가 있으면 `updatePlanGroupDraftAction`으로 업데이트
- 없으면 새로 생성

### 3. `_createPlanGroup` 함수 개선

**파일**: `app/(student)/actions/plan-groups/create.ts`

- `draftGroupId`가 없어도 기존 draft 확인
- 기존 draft가 있으면 `updatePlanGroupDraftAction`으로 업데이트
- 없으면 새로 생성

## 수정된 파일

- `app/(student)/actions/plan-groups/utils.ts`: 기존 draft 확인 유틸리티 함수 추가
- `app/(student)/actions/plan-groups/create.ts`: 중복 생성 방지 로직 추가

## 테스트 시나리오

1. **일반 모드 플랜 생성**
   - 플랜 이름 입력 후 저장
   - 동일한 이름으로 다시 저장 시도
   - 기존 draft가 업데이트되는지 확인

2. **캠프 모드 플랜 생성**
   - 캠프 초대 ID로 플랜 생성
   - 동일한 캠프 초대 ID로 다시 생성 시도
   - 기존 draft가 업데이트되는지 확인

3. **플랜 그룹 생성 플로우**
   - Step 1에서 플랜 이름 입력 후 자동 저장
   - Step 5에서 최종 제출
   - 중복 생성되지 않는지 확인

## 예상 효과

- 플랜 목록에서 중복 항목이 생성되지 않음
- 자동 저장과 최종 제출 시 동일한 draft가 재사용됨
- 데이터 일관성 향상








