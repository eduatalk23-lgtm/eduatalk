# 캠프 템플릿 작성 후 리다이렉트 경로 수정

## 작업 개요

관리자 페이지에서 캠프 템플릿을 작성한 후 잘못된 시간 관리 페이지로 이동하는 문제를 수정했습니다.

## 문제 분석

### 발견된 문제

`app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`의 `handleTemplateSave` 함수에서:

- 템플릿 저장 성공 후 `/admin/time-management/${result.templateId}`로 리다이렉트
- 이 경로는 캠프 템플릿 전용 시간 관리 페이지가 아닌 일반 시간 관리 페이지로 이동
- 올바른 경로는 `/admin/camp-templates/${result.templateId}` (템플릿 상세 페이지) 또는 `/admin/camp-templates/${result.templateId}/time-management` (캠프 템플릿 전용 시간 관리 페이지)

### 기대 동작

템플릿 생성 후 템플릿 상세 페이지로 이동하여:
1. 생성된 템플릿 정보 확인
2. 필요 시 시간 관리 페이지로 이동 가능
3. 초대 발송 등 추가 작업 가능

## 해결 방안

템플릿 생성 성공 후 템플릿 상세 페이지(`/admin/camp-templates/${templateId}`)로 리다이렉트하도록 수정했습니다.

## 수정 내용

### 파일: `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`

**변경 전:**

```typescript
// 템플릿 저장 성공 후 시간 관리 페이지로 리다이렉트
if (result.templateId) {
  toast.showSuccess("템플릿이 성공적으로 생성되었습니다. 이제 블록 세트를 생성해주세요.");
  router.push(`/admin/time-management/${result.templateId}`);
}
```

**변경 후:**

```typescript
// 템플릿 저장 성공 후 템플릿 상세 페이지로 리다이렉트
if (result.templateId) {
  toast.showSuccess("템플릿이 성공적으로 생성되었습니다.");
  router.push(`/admin/camp-templates/${result.templateId}`);
}
```

## 변경 사항 요약

1. **리다이렉트 경로 수정**
   - `/admin/time-management/${templateId}` → `/admin/camp-templates/${templateId}`

2. **토스트 메시지 간소화**
   - "템플릿이 성공적으로 생성되었습니다. 이제 블록 세트를 생성해주세요." → "템플릿이 성공적으로 생성되었습니다."
   - 템플릿 상세 페이지에서 필요한 작업을 안내할 수 있으므로 메시지 간소화

## 검증 사항

- ✅ 템플릿 생성 후 올바른 페이지로 이동
- ✅ 템플릿 상세 페이지에서 템플릿 정보 확인 가능
- ✅ 템플릿 상세 페이지에서 시간 관리 페이지로 이동 가능
- ✅ 린터 오류 없음

## 관련 파일

- `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx` - 템플릿 생성 폼
- `app/(admin)/admin/camp-templates/[id]/page.tsx` - 템플릿 상세 페이지
- `app/(admin)/admin/camp-templates/[id]/time-management/page.tsx` - 캠프 템플릿 전용 시간 관리 페이지

## 참고 사항

템플릿 수정 폼(`CampTemplateEditForm.tsx`)은 이미 올바른 경로로 리다이렉트하고 있어 수정이 필요하지 않았습니다.

---

**작업 일시**: 2024년 11월
**작업자**: AI Assistant

