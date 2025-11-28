# 관리자 캠프 템플릿 네비게이션 및 삭제 기능 수정

## 작업 일자
2025-11-28

## 문제점

### 1. 404 에러 발생
- **위치**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- **문제**: "시간 관리" 버튼 클릭 시 404 에러 발생
- **원인**: 잘못된 경로 사용
  - 잘못된 경로: `/admin/time-management/${template.id}`
  - 올바른 경로: `/admin/camp-templates/${template.id}/time-management`

### 2. 삭제 다이얼로그가 닫히지 않음
- **위치**: `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`
- **문제**: 캠프 템플릿 삭제 후 다이얼로그가 닫히지 않고 화면이 업데이트되지 않음
- **원인**:
  1. 삭제 성공 시 `isDeleting` 상태가 리셋되지 않음
  2. `router.refresh()`만으로는 클라이언트 상태 업데이트가 즉시 반영되지 않음
  3. 삭제된 항목이 목록에서 제거되지 않음

## 수정 내용

### 1. 경로 수정 (404 에러 해결)

**파일**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

```typescript
// 수정 전
<Link
  href={`/admin/time-management/${template.id}`}
  className="..."
>
  시간 관리
</Link>

// 수정 후
<Link
  href={`/admin/camp-templates/${template.id}/time-management`}
  className="..."
>
  시간 관리
</Link>
```

### 2. 삭제 로직 개선 (다이얼로그 닫힘 문제 해결)

**파일**: `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`

```typescript
// 수정 전
const confirmDelete = async () => {
  setIsDeleting(true);
  try {
    const result = await deleteCampTemplateAction(template.id);
    if (result.success) {
      toast.showSuccess("템플릿이 삭제되었습니다.");
      router.refresh();
      setShowDeleteDialog(false);
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

// 수정 후
const confirmDelete = async () => {
  setIsDeleting(true);
  try {
    const result = await deleteCampTemplateAction(template.id);
    if (result.success) {
      toast.showSuccess("템플릿이 삭제되었습니다.");
      setShowDeleteDialog(false); // 다이얼로그 먼저 닫기
      setIsDeleting(false); // 상태 리셋
      router.push("/admin/camp-templates"); // 목록 페이지로 이동
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

## 개선 사항

1. **경로 수정**: 올바른 경로로 수정하여 404 에러 해결
2. **상태 관리 개선**: 
   - 삭제 성공 시 `isDeleting` 상태를 명시적으로 리셋
   - 다이얼로그를 먼저 닫아 사용자 경험 개선
3. **페이지 이동**: `router.refresh()` 대신 `router.push()`를 사용하여 목록 페이지로 이동하여 삭제된 항목이 즉시 반영되도록 개선

## 테스트 항목

- [x] "시간 관리" 버튼 클릭 시 올바른 페이지로 이동하는지 확인
- [x] 캠프 템플릿 삭제 시 다이얼로그가 정상적으로 닫히는지 확인
- [x] 삭제 후 목록 페이지로 이동하는지 확인
- [x] 삭제된 템플릿이 목록에서 제거되는지 확인

## 관련 파일

- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`

