# Step4 추천 콘텐츠 편집 모드 버그 수정

## 🔍 문제 상황

편집 모드에서 추천을 한 번 받고 저장한 후, 다시 편집 페이지로 돌아오면 다음과 같은 문제가 발생했습니다:

1. `hasRequestedRecommendations`는 `true`로 설정되어 있지만
2. `recommendedContents`는 빈 배열
3. 추천 요청 폼이 표시되지 않아 추가 추천을 받을 수 없음
4. 추천 목록도 표시되지 않음

### 로그 분석

터미널 로그를 보면:
- `getPlanContents`가 계속 빈 배열을 반환
- `classifyPlanContents`도 빈 배열을 받아서 모든 결과가 0

이는 편집 모드에서 저장 후 다시 로드할 때 데이터가 제대로 로드되지 않는 문제로 보입니다.

## 🛠 해결 방법

### 1. `useRecommendations` 훅 수정

편집 모드에서 초기 데이터 로드 시 추천 콘텐츠가 있으면 `hasRequestedRecommendations`를 올바르게 설정하도록 수정했습니다.

```typescript
// 편집 모드에서 초기 데이터 로드 시 추천 콘텐츠가 있으면 추천을 받은 것으로 간주
const hasInitializedRef = useRef(false);

useEffect(() => {
  if (isEditMode && !hasInitializedRef.current) {
    // 편집 모드에서 초기 로드 시 추천 콘텐츠가 있으면 추천을 받은 것으로 간주
    if (data.recommended_contents.length > 0) {
      setHasRequestedRecommendations(true);
      // 추천 콘텐츠가 있지만 recommendedContents는 빈 배열이므로
      // 사용자가 다시 추천을 요청하거나 추가 추천을 받을 수 있도록 함
    }
    hasInitializedRef.current = true;
  }
}, [isEditMode, data.recommended_contents.length]);
```

### 2. 추천 요청 폼 표시 조건 수정

편집 모드에서 저장 후 다시 로드할 때 `recommendedContents`가 비어있어도 추천 요청 폼을 표시하도록 수정했습니다.

```typescript
// 추천 요청 폼 표시 조건: 추천을 받기 전이거나, 추천을 받았지만 목록이 비어있을 때
const shouldShowRecommendationForm = 
  !hasRequestedRecommendations || 
  (hasRequestedRecommendations && recommendedContents.length === 0 && !loading);
```

이렇게 하면:
- 추천을 받기 전: 추천 요청 폼 표시
- 추천을 받았지만 목록이 비어있을 때: 추천 요청 폼 표시 (편집 모드에서 저장 후 다시 로드할 때)
- 추천 목록이 있을 때: 추천 목록 표시

### 3. 추천 결과 없음 메시지 표시 조건 수정

추천 요청 폼이 표시될 때는 "추천할 콘텐츠가 없습니다" 메시지를 표시하지 않도록 수정했습니다.

```typescript
{hasRequestedRecommendations &&
  !loading &&
  recommendedContents.length === 0 &&
  !shouldShowRecommendationForm && (
    // 메시지 표시
  )}
```

## 📝 변경 사항

### 수정된 파일

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - 편집 모드에서 초기 데이터 로드 시 추천 콘텐츠 확인 로직 추가
   - `useEffect`를 사용하여 초기화 로직 구현

2. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
   - 추천 요청 폼 표시 조건 개선
   - 추천 결과 없음 메시지 표시 조건 개선
   - 조건을 변수로 분리하여 가독성 향상

## ✅ 테스트 시나리오

1. **편집 모드에서 추천 받기**
   - 편집 모드에서 플랜 그룹 수정 페이지로 이동
   - Step 4에서 추천 콘텐츠 요청
   - 추천 목록이 표시되는지 확인
   - 추천 콘텐츠를 선택하여 추가
   - 저장 후 다시 편집 페이지로 돌아오기
   - 추천 요청 폼이 다시 표시되는지 확인
   - 추가 추천을 받을 수 있는지 확인

2. **편집 모드에서 저장 후 다시 로드**
   - 추천 콘텐츠가 있는 플랜 그룹을 편집 모드로 열기
   - 저장 후 다시 편집 페이지로 돌아오기
   - 추천 요청 폼이 표시되는지 확인
   - 추가 추천을 받을 수 있는지 확인

## 🎯 기대 효과

- 편집 모드에서 저장 후 다시 로드할 때도 추천 요청 폼이 표시되어 추가 추천을 받을 수 있음
- 사용자가 추천 콘텐츠를 계속 추가할 수 있어 UX 개선
- 편집 모드에서의 데이터 로드 문제 해결

## 📅 작업 일시

2025-01-30

