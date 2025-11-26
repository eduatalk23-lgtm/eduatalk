# 캠프 템플릿 삭제 후 리다이렉트 개선

## 작업 개요

캠프 템플릿 삭제 후 템플릿 목록으로 리다이렉트가 실행되지 않는 문제를 해결했습니다.

## 문제 분석

`app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`의 `handleDelete` 함수에서:
- 삭제 성공 후 `router.push("/admin/camp-templates")`를 호출하지만 리다이렉트가 실행되지 않음
- 삭제 실패 시 `result.success`가 false인 경우에 대한 처리가 없음
- 삭제된 템플릿의 상세 페이지에서 리다이렉트가 제대로 작동하지 않을 수 있음

## 해결 방안

1. **`router.push` 대신 `router.replace` 사용**
   - 브라우저 히스토리에서 삭제된 템플릿 페이지를 제거
   - 뒤로가기 시 삭제된 페이지로 돌아가지 않도록 방지

2. **에러 처리 개선**
   - 삭제 실패 시 (`result.success === false`)에도 에러 메시지 표시 및 UI 상태 복구
   - 모든 에러 케이스에 대해 `setIsDeleting(false)` 호출

## 수정 내용

### 파일: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

**변경 전:**
```typescript
const handleDelete = async () => {
  setIsDeleting(true);
  try {
    const result = await deleteCampTemplateAction(template.id);
    if (result.success) {
      toast.showSuccess("템플릿이 삭제되었습니다.");
      router.push("/admin/camp-templates");
    }
  } catch (error) {
    console.error("템플릿 삭제 실패:", error);
    const errorMessage =
      error instanceof Error ? error.message : "템플릿 삭제에 실패했습니다.";
    toast.showError(errorMessage);
    setIsDeleting(false);
  }
};
```

**변경 후:**
```typescript
const handleDelete = async () => {
  setIsDeleting(true);
  try {
    const result = await deleteCampTemplateAction(template.id);
    if (result.success) {
      toast.showSuccess("템플릿이 삭제되었습니다.");
      // router.push 대신 router.replace 사용하여 히스토리에서 제거
      router.replace("/admin/camp-templates");
    } else {
      toast.showError(result.error || "템플릿 삭제에 실패했습니다.");
      setIsDeleting(false);
    }
  } catch (error) {
    console.error("템플릿 삭제 실패:", error);
    const errorMessage =
      error instanceof Error ? error.message : "템플릿 삭제에 실패했습니다.";
    toast.showError(errorMessage);
    setIsDeleting(false);
  }
};
```

## 주요 변경사항

1. **`router.push` → `router.replace` 변경**
   - 삭제된 템플릿 페이지가 브라우저 히스토리에 남지 않도록 함
   - 뒤로가기 시 삭제된 페이지로 돌아가지 않음

2. **에러 처리 추가**
   - `result.success === false`인 경우에도 에러 메시지 표시 및 UI 상태 복구
   - 모든 에러 케이스에 대해 일관된 처리

## 테스트 시나리오

1. ✅ 템플릿 상세 페이지에서 삭제 버튼 클릭
2. ✅ 삭제 확인 다이얼로그에서 확인 클릭
3. ✅ 삭제 성공 후 템플릿 목록 페이지로 리다이렉트 확인
4. ✅ 뒤로가기 버튼 클릭 시 삭제된 템플릿 페이지로 돌아가지 않는지 확인
5. ✅ 삭제 실패 시 에러 메시지 표시 및 UI 상태 복구 확인

## 관련 파일

- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx` - 삭제 핸들러 수정
- `app/(admin)/actions/campTemplateActions.ts` - 삭제 액션 (변경 없음)

## 작업 일시

2025-01-XX

