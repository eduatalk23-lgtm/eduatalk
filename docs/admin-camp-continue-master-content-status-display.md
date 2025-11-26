# 관리자 페이지 캠프 모드 '남은 단계 진행하기' 마스터 콘텐츠 상태 표시 추가

## 🔍 작업 개요

관리자 페이지에서 캠프 모드의 '남은 단계 진행하기' 기능에서 학생 콘텐츠 목록에 마스터에서 가져온 교재/강의인지 상태를 표시하도록 개선했습니다.

## ✅ 변경 사항

### 1. `continue/page.tsx` - 마스터 콘텐츠 ID 전달

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

`classifyPlanContents`에서 조회한 `masterContentId` 정보를 `wizardData`로 변환할 때 포함하도록 수정했습니다.

```typescript
.map((c) => {
  // classifyPlanContents에서 조회한 정보를 우선적으로 사용
  const classifiedContent = contentsMap.get(c.content_id);
  return {
    ...c,
    title: classifiedContent?.title || undefined,
    subject_category: classifiedContent?.subject_category || undefined,
    master_content_id: classifiedContent?.masterContentId || c.master_content_id || undefined, // 추가
  };
})
```

### 2. `planGroupDataSync.ts` - 마스터 콘텐츠 ID 포함

**파일**: `lib/utils/planGroupDataSync.ts`

`syncCreationDataToWizardData` 함수에서 `master_content_id` 정보를 `wizardData`에 포함하도록 수정했습니다.

```typescript
const contentItem = {
  content_type: c.content_type as "book" | "lecture",
  content_id: c.content_id,
  start_range: c.start_range,
  end_range: c.end_range,
  // ...
  // master_content_id가 있으면 포함 (마스터에서 가져온 교재/강의 표시용)
  ...((c as any).master_content_id && { master_content_id: (c as any).master_content_id }),
};
```

### 3. `Step4RecommendedContents.tsx` - 마스터 상태 표시 추가

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

"현재 추가된 학생 콘텐츠 분석" 섹션에서 마스터에서 가져온 교재/강의인 경우 상태 배지를 표시하도록 추가했습니다.

```typescript
{masterContentId && (
  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
    📦 마스터에서 가져옴
  </span>
)}
```

표시 위치는 교재/강의 타입 아이콘 옆, 교재 상태 표시 옆에 표시됩니다.

## 📋 기존 기능

### Step3Contents의 마스터 상태 표시

`Step3Contents` 컴포넌트의 "추가된 학생 콘텐츠 목록"에서는 이미 `contents` prop을 통해 마스터 상태를 확인하고 표시하고 있습니다:

```typescript
{(() => {
  const contentType = content.content_type;
  const contentId = content.content_id;
  const foundContent = contentType === "book"
    ? contents.books.find((b) => b.id === contentId)
    : contents.lectures.find((l) => l.id === contentId);
  return foundContent?.master_content_id ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
      📦 마스터에서 가져옴
    </span>
  ) : null;
})()}
```

## 🎨 UI/UX

마스터에서 가져온 교재/강의는 다음과 같이 표시됩니다:

- **배지 스타일**: 파란색 배경, 파란색 텍스트
- **아이콘**: 📦
- **텍스트**: "마스터에서 가져옴"
- **위치**: 교재/강의 타입 아이콘 옆, 상태 정보 영역에 표시

이 스타일은 교재/강의 관리 페이지(`BookInfoSection`, `LectureInfoSection`)의 마스터 상태 표시와 일관성을 유지합니다.

## 🔄 데이터 흐름

1. **데이터 조회**: `continue/page.tsx`에서 `classifyPlanContents`를 통해 콘텐츠 정보와 `masterContentId` 조회
2. **데이터 전달**: `syncCreationDataToWizardData`를 통해 `wizardData`에 `master_content_id` 포함
3. **표시**: `Step4RecommendedContents`에서 `data.student_contents`의 `master_content_id` 확인하여 상태 배지 표시

## ✅ 검증 완료

- [x] `continue/page.tsx`에서 `master_content_id` 전달 확인
- [x] `planGroupDataSync.ts`에서 `master_content_id` 포함 확인
- [x] `Step4RecommendedContents.tsx`에서 마스터 상태 표시 추가
- [x] Step3Contents의 기존 마스터 상태 표시 기능 확인
- [x] 린터 오류 없음

## 📝 참고 사항

- Step3Contents는 이미 `contents` prop을 통해 마스터 상태를 확인하고 있으므로 추가 수정이 필요 없습니다.
- 마스터 상태 표시는 학생 콘텐츠(`data.student_contents`)에만 적용되며, 추천 콘텐츠는 마스터 콘텐츠이므로 별도 표시가 필요 없습니다.
- `master_content_id`가 있는 경우에만 배지가 표시되며, 없으면 표시되지 않습니다.

