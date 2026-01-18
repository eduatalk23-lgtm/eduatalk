# 캠프 템플릿 상태 변경 UI 및 삭제/학습기간 조회 수정

## 작업 일시
2025-01-XX

## 작업 내용

### 1. 템플릿 상태 변경 UI 추가

#### 변경 파일
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `app/(admin)/actions/campTemplateActions.ts`

#### 구현 내용
- 템플릿 상세 페이지에 상태 변경 버튼 추가
- 초안 ↔ 활성 상태 전환 기능 구현
- 상태 변경 액션 함수 추가 (`updateCampTemplateStatusAction`)
- 상태 변경 후 페이지 새로고침

#### 주요 변경사항
```typescript
// 상태 변경 액션 추가
export const updateCampTemplateStatusAction = withErrorHandling(
  async (templateId: string, status: "draft" | "active" | "archived") => {
    // 권한 검증 및 상태 변경 로직
  }
);

// UI에 상태 변경 버튼 추가
{currentStatus !== "archived" && (
  <button onClick={() => handleStatusChange(...)}>
    {currentStatus === "draft" ? "활성화" : "초안으로 변경"}
  </button>
)}
```

### 2. 템플릿 삭제 다이얼로그 개선

#### 변경 파일
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

#### 구현 내용
- 삭제 성공 시 다이얼로그 자동 닫기
- 삭제 중 상태 표시 개선
- 삭제 실패 시에도 다이얼로그 유지하여 에러 메시지 표시

#### 주요 변경사항
```typescript
const handleDelete = async () => {
  setIsDeleting(true);
  try {
    const result = await deleteCampTemplateAction(template.id);
    if (result.success) {
      toast.showSuccess("템플릿이 삭제되었습니다.");
      setShowDeleteDialog(false); // 다이얼로그 닫기
      router.replace("/admin/camp-templates");
    } else {
      // 에러 처리 및 다이얼로그 유지
      setIsDeleting(false);
    }
  } catch (error) {
    // 에러 처리 및 다이얼로그 유지
    setIsDeleting(false);
  }
};
```

### 3. 학습기간 조회 수정

#### 변경 파일
- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 구현 내용
- `templateData`에서 `period_start`와 `period_end`를 명시적으로 추출
- `initialData`에 학습기간 필드 포함
- 템플릿 수정 시 학습기간이 제대로 조회되도록 수정

#### 주요 변경사항
```typescript
const initialData = {
  ...templateData,
  templateId: template.id,
  templateProgramType: template.program_type,
  templateStatus: template.status,
  // 학습기간 명시적으로 포함
  period_start: templateData.period_start || "",
  period_end: templateData.period_end || "",
};
```

## 테스트 항목

### 상태 변경 기능
- [ ] 초안 상태에서 활성화 버튼 클릭 시 활성 상태로 변경되는지 확인
- [ ] 활성 상태에서 초안으로 변경 버튼 클릭 시 초안 상태로 변경되는지 확인
- [ ] 상태 변경 후 페이지가 새로고침되는지 확인
- [ ] 상태 변경 후 초대 발송 가능 여부가 올바르게 반영되는지 확인

### 삭제 다이얼로그
- [ ] 삭제 중일 때 버튼이 "삭제 중..."으로 표시되는지 확인
- [ ] 삭제 성공 시 다이얼로그가 닫히는지 확인
- [ ] 삭제 실패 시 다이얼로그가 유지되고 에러 메시지가 표시되는지 확인

### 학습기간 조회
- [ ] 템플릿 수정 페이지에서 학습기간이 올바르게 표시되는지 확인
- [ ] 학습기간 수정 후 저장이 정상적으로 되는지 확인
- [ ] 학습기간이 없는 템플릿도 정상적으로 처리되는지 확인

## 관련 파일

- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
- `app/(admin)/actions/campTemplateActions.ts`

