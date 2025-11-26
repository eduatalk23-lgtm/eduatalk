# 캠프 템플릿 입력 페이지 네비게이션 버튼 수정

## 🔍 문제 상황

학생 페이지의 캠프 템플릿 입력 페이지에서 두 개의 네비게이션 버튼이 표시되었습니다:

1. **'목록으로 돌아가기'** 버튼 (`/camp`로 이동) - 상위 페이지에 있음
2. **'플랜 목록'** 버튼 (`/plan`으로 이동) - `PlanGroupWizard` 컴포넌트 내부에 있음

캠프 템플릿 페이지에서는 '플랜 목록' 버튼이 불필요하며, '목록으로 돌아가기' 버튼만 유지해야 합니다.

## 🛠 해결 방법

### 파일: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 전**:
```tsx
<div className="flex items-center gap-2">
  <Link
    href={
      isTemplateMode
        ? "/admin/camp-templates"
        : isEditMode
        ? `/plan/group/${draftGroupId}`
        : "/plan"
    }
    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
  >
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
    {isTemplateMode
      ? "템플릿 목록"
      : isEditMode
      ? "상세 보기"
      : "플랜 목록"}
  </Link>
</div>
```

**변경 후**:
```tsx
<div className="flex items-center gap-2">
  {/* 캠프 모드일 때는 버튼 숨김 (상위 페이지의 '목록으로 돌아가기' 버튼 사용) */}
  {!isCampMode && (
    <Link
      href={
        isTemplateMode
          ? "/admin/camp-templates"
          : isEditMode
          ? `/plan/group/${draftGroupId}`
          : "/plan"
      }
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {isTemplateMode
        ? "템플릿 목록"
        : isEditMode
        ? "상세 보기"
        : "플랜 목록"}
    </Link>
  )}
</div>
```

## ✅ 결과

1. **캠프 모드에서 '플랜 목록' 버튼 숨김**
   - `isCampMode`가 `true`일 때 네비게이션 버튼이 표시되지 않음
   - 상위 페이지(`app/(student)/camp/[invitationId]/page.tsx`)의 '목록으로 돌아가기' 버튼만 표시됨

2. **일반 모드에서는 기존 동작 유지**
   - `isCampMode`가 `false`일 때는 기존과 동일하게 '플랜 목록' 버튼 표시
   - 템플릿 모드, 편집 모드에서도 기존 동작 유지

3. **사용자 경험 개선**
   - 캠프 템플릿 페이지에서 혼란스러운 중복 버튼 제거
   - 명확한 네비게이션 경로 제공

## 🔗 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 위저드 컴포넌트 (수정됨)
- `app/(student)/camp/[invitationId]/page.tsx` - 캠프 참여 페이지 (기존 '목록으로 돌아가기' 버튼 유지)

## 📝 참고 사항

### 버튼 표시 로직

- **캠프 모드 (`isCampMode === true`)**: 네비게이션 버튼 숨김
- **일반 모드 (`isCampMode === false`)**: '플랜 목록' 버튼 표시
- **템플릿 모드 (`isTemplateMode === true`)**: '템플릿 목록' 버튼 표시
- **편집 모드 (`isEditMode === true`)**: '상세 보기' 버튼 표시

### 네비게이션 경로

- 캠프 템플릿 페이지: `/camp` (상위 페이지의 '목록으로 돌아가기' 버튼)
- 일반 플랜 생성: `/plan` (위저드 내부의 '플랜 목록' 버튼)
- 템플릿 관리: `/admin/camp-templates` (위저드 내부의 '템플릿 목록' 버튼)

---

**작업 날짜**: 2025년 11월 28일  
**작업자**: AI Assistant

