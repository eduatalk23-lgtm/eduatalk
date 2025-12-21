# 관리자 영역 템플릿 모드 학생 권한 문제 해결

## 📋 문제 상황

관리자 영역(`/admin/camp-templates/.../edit`)에서 캠프 템플릿을 편집할 때, `PlanGroupWizard`가 학생 전용 액션(`createPlanGroupAction`, `savePlanGroupDraftAction`)을 호출하여 `requireStudentAuth`에서 권한 오류가 발생했습니다.

### 에러 메시지
```
Error [AppError]: 학생 권한이 필요합니다.
  at requireStudentAuth (lib/auth/requireStudentAuth.ts:34:11)
  at async _createPlanGroup (app/(student)/actions/plan-groups/create.ts:64:16)
```

### 원인 분석

1. **템플릿 모드에서도 임시 저장 호출**: `CampTemplateEditForm`에서 `PlanGroupWizard`를 `isTemplateMode={true}`로 사용하지만, 내부적으로 자동 임시 저장 기능이 작동하여 학생 전용 액션을 호출했습니다.

2. **템플릿 모드 체크 누락**: `usePlanDraft`와 `usePlanGenerator` 훅에서 템플릿 모드 여부를 확인하지 않아, 템플릿 모드에서도 플랜 그룹 생성/저장을 시도했습니다.

3. **관리자 모드에서 studentId 미전달**: 관리자 모드에서 `createPlanGroupAction`을 호출할 때 `studentId` 옵션을 전달하지 않아, 권한 체크에서 실패했습니다.

## 🔧 해결 방법

### 1. `usePlanDraft`에 템플릿 모드 체크 추가

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts`

- `isTemplateMode` prop 추가
- 템플릿 모드일 때는 임시 저장을 건너뛰도록 수정

```typescript
const saveDraft = useCallback(
  async (silent: boolean = false) => {
    // 템플릿 모드일 때는 임시 저장을 건너뛰기 (템플릿은 별도 저장 로직 사용)
    if (isTemplateMode) {
      if (!silent) {
        toast.showInfo("템플릿 모드에서는 저장 버튼을 사용해주세요.");
      }
      return;
    }
    // ... 기존 로직
  },
  [/* ... */, isTemplateMode]
);
```

### 2. `usePlanGenerator`에 템플릿 모드 체크 추가

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts`

- `isTemplateMode` prop 추가
- 템플릿 모드일 때는 플랜 그룹 생성 시도 시 에러 발생
- 관리자 모드일 때 `studentId` 옵션 전달

```typescript
// 템플릿 모드일 때는 플랜 그룹을 생성하지 않음
if (isTemplateMode) {
  throw new Error("템플릿 모드에서는 플랜 그룹을 생성할 수 없습니다.");
}

// 관리자 모드일 때는 studentId를 옵션으로 전달
const options: { skipContentValidation?: boolean; studentId?: string | null } = {
  skipContentValidation,
};

if (isAdminMode && initialData?.studentId) {
  options.studentId = initialData.studentId;
} else if (isAdminMode && initialData?.student_id) {
  options.studentId = initialData.student_id;
}

const result = await createPlanGroupAction(creationData, options);
```

### 3. `usePlanSubmission`에서 템플릿 모드 전달

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`

- `usePlanDraft`와 `usePlanGenerator`에 `isTemplateMode` 전달

```typescript
const { saveDraft, isSaving } = usePlanDraft({
  // ... 기존 props
  isTemplateMode: mode.isTemplateMode,
});

const { generatePlans, createOrUpdatePlanGroup, isGenerating } = usePlanGenerator({
  // ... 기존 props
  isTemplateMode: mode.isTemplateMode,
});
```

## 📊 변경 사항 요약

### 수정된 파일

1. `app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts`
   - `isTemplateMode` prop 추가
   - 템플릿 모드일 때 임시 저장 건너뛰기

2. `app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts`
   - `isTemplateMode` prop 추가
   - 템플릿 모드일 때 플랜 그룹 생성 방지
   - 관리자 모드에서 `studentId` 옵션 전달

3. `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`
   - `usePlanDraft`와 `usePlanGenerator`에 `isTemplateMode` 전달

### 동작 변경

**변경 전**:
- 템플릿 모드에서도 자동 임시 저장 시도
- 학생 전용 액션 호출로 권한 오류 발생

**변경 후**:
- 템플릿 모드에서는 임시 저장 건너뛰기
- 템플릿 모드에서는 플랜 그룹 생성 시도 시 명확한 에러 메시지
- 관리자 모드에서 `studentId` 옵션 전달로 권한 문제 해결

## ✅ 검증 완료

- [x] 템플릿 모드에서 임시 저장 건너뛰기
- [x] 템플릿 모드에서 플랜 그룹 생성 방지
- [x] 관리자 모드에서 `studentId` 옵션 전달
- [x] 린터 오류 없음
- [x] 타입 안전성 보장

## 📝 참고

### 템플릿 모드 동작

템플릿 모드(`isTemplateMode={true}`)에서는:
- 실제 플랜 그룹을 생성하지 않음
- 템플릿 데이터만 `template_data` 필드에 저장
- `onTemplateSave` 콜백을 통해 템플릿 저장 처리

### 관리자 모드 동작

관리자 모드(`isAdminMode={true}`)에서는:
- `initialData.studentId` 또는 `initialData.student_id`를 `createPlanGroupAction`에 전달
- `_createPlanGroup` 내부에서 관리자 권한 확인 후 지정된 학생의 플랜 그룹 생성

