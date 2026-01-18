# 관리자 남은 단계 진행 시 콘텐츠 추천 받기 버튼 표시 수정

## 📋 작업 개요

**작업 일시**: 2025-02-02  
**작업 내용**: 관리자 모드에서 캠프 템플릿의 남은 단계 진행 시 "콘텐츠 추천 받기" 버튼이 표시되지 않는 문제 수정

## 🔍 문제 상황

### 발생 위치
- URL: `/admin/camp-templates/[id]/participants/[groupId]/continue`
- 페이지: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

### 문제점
- 관리자 모드(`isAdminContinueMode=true`)에서 Step 4 (콘텐츠 선택) 단계로 진입했을 때
- "콘텐츠 추천 받기" 버튼이 표시되지 않음
- `Step4RecommendedContents` 컴포넌트는 이미 `isAdminContinueMode`를 받아서 처리하고 있었지만
- 실제로 사용되는 `Step3ContentSelection` → `RecommendedContentsPanel` 경로에서는 `isAdminContinueMode`가 전달되지 않음

## 🔧 수정 내용

### 1. PlanGroupWizard에서 isAdminContinueMode prop 전달

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

```typescript
{currentStep === 4 && (
  <Step3ContentSelection
    data={wizardData}
    onUpdate={updateWizardData}
    contents={initialContents}
    isCampMode={isCampMode}
    isTemplateMode={isTemplateMode}
    isEditMode={isEditMode}
    studentId={(initialData as any)?.student_id}
    editable={isAdminContinueMode || !isCampMode}
    isAdminContinueMode={isAdminContinueMode} // ✅ 추가
  />
)}
```

### 2. Step3ContentSelection에서 isAdminContinueMode prop 받기 및 전달

**파일**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

#### Props 타입 수정
```typescript
export function Step3ContentSelection({
  // ... 기존 props
  isAdminContinueMode = false, // ✅ 추가
}: Step3ContentSelectionProps & { 
  isTemplateMode?: boolean; 
  isAdminContinueMode?: boolean; // ✅ 추가
}) {
```

#### RecommendedContentsPanel에 전달
```typescript
<RecommendedContentsPanel
  // ... 기존 props
  isAdminContinueMode={isAdminContinueMode} // ✅ 추가
/>
```

### 3. RecommendedContentsPanel에서 추천 받기 폼 표시 조건 수정

**파일**: `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`

#### Props 타입 수정
```typescript
export function RecommendedContentsPanel({
  // ... 기존 props
  isAdminContinueMode = false, // ✅ 추가
}: RecommendedContentsPanelProps) {
```

#### 표시 조건 로직 수정
```typescript
// 기존: !isEditMode && !hasRequestedRecommendations
// 수정: 관리자 모드일 때는 항상 표시
const shouldShowRecommendationForm =
  isAdminContinueMode || // ✅ 관리자 모드일 때는 항상 표시
  (!isEditMode && !hasRequestedRecommendations) ||
  (hasRequestedRecommendations &&
    recommendedContents.length === 0 &&
    !loading);

// 렌더링 부분
{shouldShowRecommendationForm && (
  <div className="rounded-xl border border-gray-200 bg-white p-6">
    {/* 추천 받기 폼 */}
  </div>
)}
```

### 4. 타입 정의 추가

**파일**: `lib/types/content-selection.ts`

```typescript
export type RecommendedContentsPanelProps = {
  // ... 기존 props
  isAdminContinueMode?: boolean; // ✅ 추가
};
```

## ✅ 수정 결과

### 수정 전
- 관리자 모드에서 Step 4 진입 시 "콘텐츠 추천 받기" 버튼이 표시되지 않음
- `isAdminContinueMode`가 `RecommendedContentsPanel`까지 전달되지 않음

### 수정 후
- 관리자 모드에서 Step 4 진입 시 "콘텐츠 추천 받기" 버튼이 항상 표시됨
- `isAdminContinueMode`가 `PlanGroupWizard` → `Step3ContentSelection` → `RecommendedContentsPanel`까지 정상적으로 전달됨

## 📝 참고 사항

### 관련 컴포넌트 구조
```
PlanGroupWizard
  └─ Step3ContentSelection (Step 4)
      └─ RecommendedContentsPanel
          └─ 추천 받기 폼 (조건부 렌더링)
```

### 표시 조건 로직
1. **관리자 모드** (`isAdminContinueMode=true`): 항상 표시
2. **일반 모드** (`!isEditMode && !hasRequestedRecommendations`): 추천을 받기 전에만 표시
3. **추천 받은 후 목록이 비어있을 때**: 표시 (추가 추천 가능)

### 기존 Step4RecommendedContents와의 차이
- `Step4RecommendedContents`는 이미 `isAdminContinueMode`를 받아서 처리하고 있었음
- 하지만 실제로 사용되는 경로는 `Step3ContentSelection` → `RecommendedContentsPanel`이었음
- 이 경로에서 `isAdminContinueMode`가 전달되지 않아 문제 발생

## 🧪 테스트 확인 사항

1. ✅ 관리자 모드에서 Step 4 진입 시 "콘텐츠 추천 받기" 버튼 표시 확인
2. ✅ 일반 모드에서 추천 받기 전 버튼 표시 확인
3. ✅ 추천 받은 후 목록이 비어있을 때 버튼 표시 확인
4. ✅ 추천 받은 후 목록이 있을 때 버튼 숨김 확인

## 📚 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`
- `lib/types/content-selection.ts`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

