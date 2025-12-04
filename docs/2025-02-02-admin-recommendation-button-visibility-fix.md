# 관리자 모드 추천 받기 버튼 표시 수정

## 작업 일시
2025-02-02

## 문제점 분석

1. **현재 상황**: 관리자 모드(`isAdminContinueMode`)에서 템플릿 제출 후 남은 단계 진행하기 시 추천 받기 버튼이 표시되지 않음

2. **원인**: 
   - `Step4RecommendedContents` 컴포넌트가 `isAdminContinueMode` prop을 받지 않음
   - `shouldShowRecommendationForm` 조건에서 관리자 모드일 때 항상 추천 요청 폼을 표시하도록 처리되지 않음
   - `useRecommendations` 훅에서 편집 모드일 때 `hasRequestedRecommendations`가 `true`로 설정되어 추천 요청 폼이 숨겨짐

## 해결 방안

### Phase 1: Step4RecommendedContentsProps 타입에 isAdminContinueMode 추가

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`

**변경사항**:
- `Step4RecommendedContentsProps` 타입에 `isAdminContinueMode?: boolean` 추가

### Phase 2: Step4RecommendedContents 컴포넌트에서 isAdminContinueMode prop 받기

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**변경사항**:
- 컴포넌트 props에서 `isAdminContinueMode` 받기
- `shouldShowRecommendationForm` 조건에서 `isAdminContinueMode`일 때 항상 `true` 반환

## 구현 세부사항

### Phase 1: 타입 정의 수정

```typescript
export type Step4RecommendedContentsProps = {
  data: WizardData;
  onUpdate: (
    updates: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)
  ) => void;
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string;
  isAdminContinueMode?: boolean; // 추가
};
```

### Phase 2: 컴포넌트 수정

```typescript
export default function Step4RecommendedContents({
  data,
  onUpdate,
  isEditMode = false,
  isCampMode = false,
  studentId,
  isAdminContinueMode = false, // 추가
}: Step4RecommendedContentsProps) {
  // ... 기존 코드 ...

  // 추천 요청 폼 표시 조건: 관리자 모드일 때는 항상 표시
  const shouldShowRecommendationForm =
    isAdminContinueMode || // 관리자 모드일 때는 항상 표시
    !hasRequestedRecommendations ||
    (hasRequestedRecommendations &&
      recommendedContents.length === 0 &&
      !loading);
}
```

## 관련 파일

### 수정 파일
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/types.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

### 참고 파일
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` (이미 `isAdminContinueMode` 전달 중)

## 테스트 체크리스트

- [ ] 관리자 모드에서 템플릿 제출 후 남은 단계 진행하기에서 추천 받기 버튼이 표시되는지 확인
- [ ] 관리자 모드에서 추천 받기 버튼을 클릭하여 추천 콘텐츠를 받을 수 있는지 확인
- [ ] 일반 학생 모드에서는 기존 로직대로 동작하는지 확인



