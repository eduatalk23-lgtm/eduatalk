# ContentSelector UI 간격 개선 작업

## 작업 일시
2025-02-01

## 작업 개요
`ContentSelector` 컴포넌트의 콘텐츠 항목 간 간격을 개선하여 가독성을 향상시켰습니다.

## 문제점
- 콘텐츠 목록 항목 간 간격이 `gap-2` (8px)로 너무 작아 항목들이 붙어 보였음
- 헤더, 탭, 검색, 목록 섹션 사이의 세로 간격이 부족하여 전체적으로 답답해 보였음

## 수정 내용

### 수정 파일
- `app/(student)/plan/new-group/_components/_shared/ContentSelector.tsx`

### 변경 사항

1. **메인 컨테이너 구조 개선**
   - 최상위 컨테이너 내부에 `flex flex-col gap-4` 컨테이너 추가
   - 헤더, 탭, 검색, 목록 섹션 간 일관된 간격 제공

2. **콘텐츠 목록 간격 증가**
   - 목록 컨테이너의 `gap-2` → `gap-4`로 변경
   - 항목 간 간격이 8px에서 16px로 증가하여 가독성 향상

### 코드 변경

**Before:**
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-6">
  {/* 헤더 */}
  <div className="flex items-center justify-between">...</div>
  {/* 탭 */}
  <div className="flex gap-2">...</div>
  {/* 검색 */}
  <div className="relative">...</div>
  {/* 콘텐츠 목록 */}
  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">...</div>
</div>
```

**After:**
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-6">
  <div className="flex flex-col gap-4">
    {/* 헤더 */}
    <div className="flex items-center justify-between">...</div>
    {/* 탭 */}
    <div className="flex gap-2">...</div>
    {/* 검색 */}
    <div className="relative">...</div>
    {/* 콘텐츠 목록 */}
    <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">...</div>
  </div>
</div>
```

## 가이드라인 준수

- ✅ Spacing-First 정책 준수: `gap` 우선 사용
- ✅ 외곽 여백: 최상단 래퍼의 `p-6` 유지
- ✅ 형제 요소 간 간격: 부모의 `gap-4` 사용
- ✅ 콘텐츠 항목 간 간격: 목록 컨테이너의 `gap-4` 사용

## 테스트 확인 사항

- [x] 콘텐츠 목록 항목 간 간격이 적절하게 표시됨
- [x] 섹션 간 간격이 자연스럽게 보임
- [x] 스크롤 가능한 영역(`max-h-96`)에서도 간격이 유지됨
- [x] 린터 오류 없음

## 관련 컴포넌트

유사한 패턴이 있는 다른 컴포넌트들:
- `ContentMasterSearch.tsx`: `space-y-2` 사용 (Dialog 내부)
- `MasterContentsPanel.tsx`: `space-y-2` 사용
- 기타 여러 컴포넌트에서 `space-y-2` 패턴 발견

이들 컴포넌트도 향후 개선이 필요할 수 있으나, 현재 작업 범위에서는 `ContentSelector`만 수정했습니다.

