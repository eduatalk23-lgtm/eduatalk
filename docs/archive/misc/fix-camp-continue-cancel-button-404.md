# 관리자 캠프 템플릿 Continue 페이지 취소 버튼 404 에러 수정

## 문제 상황

관리자 캠프 템플릿의 "남은 단계 진행하기" 페이지에서 취소 버튼을 클릭하면 404 에러가 발생했습니다.

- **현재 페이지**: `/admin/camp-templates/{templateId}/participants/{groupId}/continue`
- **취소 버튼 클릭 시 예상 동작**: `/admin/camp-templates/{templateId}/participants`로 이동
- **실제 동작**: 404 에러 발생

## 원인 분석

`PlanGroupWizard` 컴포넌트의 취소 버튼이 관리자 모드를 고려하지 않고 일반 학생 모드의 경로로만 리다이렉트하고 있었습니다.

```typescript
// 기존 코드 (문제)
router.push(isEditMode && draftGroupId ? `/plan/group/${draftGroupId}` : "/plan", { scroll: true });
```

이 코드는 `isAdminMode` 또는 `isAdminContinueMode`일 때를 처리하지 않아 잘못된 경로로 이동하게 되었습니다.

## 수정 내용

`PlanGroupWizard.tsx`의 취소 버튼 onClick 핸들러를 수정하여 관리자 모드일 때 올바른 경로로 리다이렉트하도록 변경했습니다.

### 변경 사항

```typescript
// 수정된 코드
onClick={() => {
  if (confirm("변경사항을 저장하지 않고 나가시겠습니까?")) {
    // 관리자 모드일 때는 캠프 템플릿 참여자 목록으로 이동
    if (isAdminMode || isAdminContinueMode) {
      const templateId = (initialData as any)?.templateId;
      if (templateId) {
        router.push(`/admin/camp-templates/${templateId}/participants`, { scroll: true });
        return;
      }
    }
    // 일반 모드일 때는 기존 로직 사용
    router.push(isEditMode && draftGroupId ? `/plan/group/${draftGroupId}` : "/plan", { scroll: true });
  }
}}
```

### 주요 변경점

1. **관리자 모드 감지**: `isAdminMode` 또는 `isAdminContinueMode`일 때를 먼저 확인
2. **templateId 사용**: `initialData`에서 `templateId`를 추출하여 올바른 경로 생성
3. **조건부 리다이렉트**: 관리자 모드일 때는 참여자 목록 페이지로, 일반 모드일 때는 기존 로직 사용

## 테스트

다음 시나리오를 테스트했습니다:

1. ✅ 관리자 모드에서 취소 버튼 클릭 시 참여자 목록 페이지로 정상 이동
2. ✅ 일반 학생 모드에서 취소 버튼 동작 정상 (기존 동작 유지)
3. ✅ 편집 모드에서 취소 버튼 동작 정상 (기존 동작 유지)

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

## 참고

- `initialData`에 `templateId`가 포함되어 있어 이를 활용하여 경로를 생성
- 관리자 모드에서도 기존 학생 모드 기능과의 호환성을 유지

