# 관리자 모드 플랜 그룹 임시저장 권한 오류 수정

## 문제 상황

관리자가 저장 버튼을 눌렀을 때 "학생 권한이 필요합니다"라는 에러가 발생했습니다.

### 에러 스택
```
at requireStudentAuth (lib/auth/requireStudentAuth.ts:34:11)
at _savePlanGroupDraft (app/(student)/actions/plan-groups/create.ts:342:16)
```

## 원인 분석

1. `_savePlanGroupDraft` 함수가 `requireStudentAuth()`만 호출하여 학생 권한만 허용
2. 관리자 모드에서도 `PlanGroupWizard`를 사용하여 `savePlanGroupDraftAction`을 호출
3. 관리자 모드에서는 특정 학생을 대신하여 플랜 그룹을 생성해야 하므로 `student_id`가 필요

## 해결 방법

### 1. `_savePlanGroupDraft` 함수 수정

- 관리자/컨설턴트 권한도 허용하도록 수정
- 관리자 모드일 때는 `student_id`를 옵션에서 가져오거나 기존 그룹에서 조회
- 학생 모드일 때는 기존처럼 현재 사용자의 ID 사용

```typescript
// 권한 확인: 학생 또는 관리자/컨설턴트
const currentUser = await getCurrentUser();
const isAdmin = currentUser.role === "admin" || currentUser.role === "consultant";

if (isAdmin) {
  // 관리자 모드: student_id를 옵션에서 가져오거나 기존 그룹에서 조회
  await requireAdminOrConsultant();
  // student_id 처리 로직
} else {
  // 학생 모드: 현재 사용자가 학생
  const studentAuth = await requireStudentAuth();
  studentId = studentAuth.userId;
}
```

### 2. `savePlanGroupDraftAction` 수정

- 옵션 파라미터 추가: `draftGroupId`, `studentId`
- 관리자 모드에서 `student_id`를 전달할 수 있도록 수정

### 3. `usePlanDraft` 훅 수정

- 관리자 모드일 때 `initialData`에서 `student_id`를 가져와 옵션으로 전달
- `draftGroupId`가 있으면 그것을 옵션으로 전달 (기존 그룹에서 `student_id` 조회용)

## 수정된 파일

1. `app/(student)/actions/plan-groups/create.ts`
   - `_savePlanGroupDraft` 함수에 관리자 권한 지원 추가
   - `savePlanGroupDraftAction`에 옵션 파라미터 추가

2. `app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts`
   - 관리자 모드일 때 `student_id`를 옵션으로 전달하도록 수정

## 테스트 시나리오

1. ✅ 학생 모드: 기존처럼 정상 작동
2. ✅ 관리자 모드 (기존 그룹 수정): `draftGroupId`로 `student_id` 조회
3. ✅ 관리자 모드 (새 그룹 생성): `initialData.student_id` 사용

## 참고사항

- 관리자 모드에서 플랜 그룹을 생성할 때는 반드시 `student_id`가 필요합니다.
- `initialData`에 `student_id`가 포함되어 있거나, `draftGroupId`가 있어야 합니다.
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`에서 `initialData`에 `student_id`를 포함하여 전달하고 있습니다.

